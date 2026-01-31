import { seed } from "drizzle-seed";
import { db } from "./src";
import * as schema from "./src/schema";

async function main() {
  const categories = ["movie", "tv", "games", "music", "other"];

  await seed(db, schema).refine((funcs) => ({
    torrents: {
      count: 50,
      columns: {
        infoHash: funcs.string({ arraySize: 40 }),

        title: funcs.valuesFromArray({
          values: [
            "Big Buck Bunny",
            "Cosmos Laundromat",
            "Sintel",
            "Tears of Steel",
            "Elephants Dream",
            "Caminandes: Llama Drama",
            "Caminandes: Gran Dillama",
            "Agent 327",
            "Spring",
            "Coffee Run",
            "Sprite Fright",
            "Charge",
            "The Daily Dweebs",
            "Glass Half",
            "Big Fish",
            "The Godfather",
            "Pulp Fiction",
            "The Shawshank Redemption",
            "The Dark Knight",
            "Inception",
            "Forrest Gump",
            "The Matrix",
            "Goodfellas",
            "The Silence of the Lambs",
            "Seven Samurai",
            "City of God",
            "Life is Beautiful",
            "Spirited Away",
            "Saving Private Ryan",
            "The Green Mile",
            "Interstellar",
            "Parasite",
            "The Prestige",
            "Gladiator",
            "The Departed",
            "Whiplash",
            "The Intouchables",
            "The Lion King",
            "Back to the Future",
            "Casablanca",
            "Psycho",
            "Rear Window",
            "Modern Times",
            "City Lights",
            "The Great Dictator",
            "Apocalypse Now",
            "Alien",
            "The Shining",
            "Blade Runner",
            "Star Wars: A New Hope",
            "The Empire Strikes Back",
            "Return of the Jedi",
            "Raiders of the Lost Ark",
            "Jaws",
            "Jurassic Park",
            "Schindler's List",
            "Eternal Sunshine of the Spotless Mind",
            "No Country for Old Men",
            "There Will Be Blood",
            "Fargo",
            "The Big Lebowski",
            "Snatch",
            "Lock, Stock and Two Smoking Barrels",
            "Trainspotting",
            "The Sixth Sense",
            "Unbreakable",
            "Signs",
            "Split",
            "The Truman Show",
            "The Grand Budapest Hotel",
            "Moonrise Kingdom",
            "The Royal Tenenbaums",
            "Fantastic Mr. Fox",
            "Isle of Dogs",
            "Arrival",
            "Sicario",
            "Dune",
            "Blade Runner 2049",
            "The Revenant",
            "Birdman",
            "Gravity",
            "Children of Men",
            "Pan's Labyrinth",
            "The Shape of Water",
            "Roma",
            "12 Years a Slave",
            "Moonlight",
            "La La Land",
            "Her",
            "Lost in Translation",
            "Ex Machina",
            "Annihilation",
            "The Social Network",
            "Gone Girl",
            "Zodiac",
            "Seven",
            "The Hateful Eight",
            "Django Unchained",
            "Inglourious Basterds",
            "Kill Bill: Vol 1",
            "Kill Bill: Vol 2",
            "Reservoir Dogs",
            "The Thing",
            "Halloween",
          ],
        }),

        size: funcs.int({
          minValue: 1048576,
          maxValue: 53687091200,
        }),

        sourceName: funcs.default({ defaultValue: "seed_script" }),

        category: funcs.valuesFromArray({ values: categories }),

        magnet: funcs.default({
          defaultValue: "magnet:?xt=urn:btih:placeholder",
        }),

        files: funcs.default({ defaultValue: JSON.stringify([]) }),
      },
    },
  }));
}

main()
  .then(() => {
    console.log("Seeding completed.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
