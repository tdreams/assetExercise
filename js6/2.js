const express = require("express");
const session = require("express-session");
const cors = require("cors");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const {
  ApolloServerPluginDrainHttpServer,
} = require("@apollo/server/plugin/drainHttpServer");
const http = require("http");
const fetch = require("node-fetch");

const app = express();
const port = 8124;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const router = express.Router();

// Setup session middleware
app.use(
  session({
    secret: "gotcha-secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

const typeDefs = `#graphql
  type Lesson {
    title: String!
  }
  
  type Pokemon {
    image: String!
    name: String!
  }

  type SearchResult {
    concatenatedNames: String!
  }

  type User {
    id: ID!
    image: String!
    lessons: [Lesson!]!
    pokemon: Pokemon!
  }

  type LoginResponse {
    user: User!
  }

  type Query {
    lessons(title: String!): [Lesson]
    pokemon(name: String!): Pokemon
    search(str: String!): SearchResult
    user: User
  }

  type Mutation {
    login(pokemon: String!): LoginResponse
    toggleLessonEnrollment(lessonTitle: String!): User
  }
`;

const fetchLessons = (url) => {
  return fetch(url).then((resp) => resp.json());
};

const resolvers = {
  Query: {
    lessons: async (_, args) => {
      return fetchLessons(`https://www.c0d3.com/api/lessons`)
        .then((lessons) => {
          if (!args.title) {
            return lessons;
          }
          return lessons.filter((lesson) => lesson.title.includes(args.title));
        })
        .catch((error) => {
          console.error("Error fetching lessons:", error);
          throw new Error("Failed to fetch lessons");
        });
    },
    pokemon: (_, args) => {
      return fetch(
        `https://pokeapi.co/api/v2/pokemon/${args.name.toLowerCase()}`
      )
        .then((response) => response.json())
        .then((data) => ({
          name: data.name,
          image: data.sprites.other["official-artwork"].front_default,
        }))
        .catch((err) => {
          console.error("Error fetching Pokemon", err);
          return null;
        });
    },
    search: (_, args) => {
      return fetch(`https://pokeapi.co/api/v2/pokemon?limit=100`)
        .then((resp) => resp.json())
        .then((data) => {
          const filteredPokemon = data.results.filter((pokemon) =>
            pokemon.name.includes(args.str.toLowerCase())
          );
          const concatenatedNames = filteredPokemon
            .reduce(
              (acc, pokemon) =>
                `${acc} <p class="filteredName" data-name="${pokemon.name}">${pokemon.name}</p>`,
              ""
            )
            .trim();
          return { concatenatedNames };
        })
        .catch((err) => {
          console.error("Error searching Pokemon", err);
          return { concatenatedNames: "" };
        });
    },
    user: (_, __, { req }) => {
      return req.session.user;
    },
  },
  Mutation: {
    login: (_, { pokemon }, { req }) => {
      return resolvers.Query.pokemon(_, { name: pokemon })
        .then((pokemonData) => {
          const user = {
            id: Date.now().toString(),
            pokemon: pokemonData,
            image: pokemonData.image,
            lessons: [],
          };
          req.session.user = user;
          return { user };
        })
        .catch((err) => {
          console.error("Error logging in", err);
          throw new Error("Login failed");
        });
    },
    toggleLessonEnrollment: (_, { lessonTitle }, { req }) => {
      const { user } = req.session;
      if (!user) {
        throw new Error("You must be logged in");
      }
      return resolvers.Query.lessons(_, { title: lessonTitle })
        .then((lessons) => {
          const lesson = lessons.find((lesson) => lesson.title === lessonTitle);
          if (!lesson) {
            throw new Error("Lesson not found");
          }
          const lessonIndex = user.lessons.findIndex(
            (enrolledLesson) => enrolledLesson.title === lessonTitle
          );
          if (lessonIndex === -1) {
            user.lessons.push(lesson);
          } else {
            user.lessons.splice(lessonIndex, 1);
          }

          return user;
        })
        .catch((err) => {
          console.error("Error enrolling in lesson", err);
          throw new Error("Enrollment failed");
        });
    },
  },
};

// Create an HTTP server
const httpServer = http.createServer(app);

// Create an Apollo Server instance
const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});

// Start Apollo Server
server
  .start()
  .then(() => {
    // Apply middleware to connect Apollo Server with Express
    router.use(
      "/graphql",
      expressMiddleware(server, {
        context: async ({ req }) => ({ req }),
      })
    );

    router.get("/addLesson", (req, res) => {
      res.sendFile("addLessons.html", { root: "./js6/public" });
    });
    router.get("/graphql-test", (req, res) => {
      res.send("GraphQL router is working");
    });

    // Mount the router to the app
    app.use("/", router);

    // Start the HTTP server
    httpServer.listen(port, () => {
      console.log(`Server running on http://localhost:${port}/graphql`);
    });
  })
  .catch((err) => {
    console.error("Error starting Apollo Server:", err);
  });

module.exports = router;
