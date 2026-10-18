// Editorial reference metadata only. Ambient artwork never renders these names.
export const roamLandmarks = [
    { id: "paris", city: "Paris", landmark: "Eiffel Tower", silhouette: "tower", collection: "vertical" },
    { id: "kyoto", city: "Kyoto", landmark: "Yasaka Pagoda", silhouette: "tower", collection: "east" },
    { id: "tokyo", city: "Tokyo", landmark: "Tokyo Tower", silhouette: "tower", collection: "vertical" },
    { id: "rome", city: "Rome", landmark: "Colosseum", silhouette: "horizontal", collection: "spans" },
    { id: "london", city: "London", landmark: "Tower Bridge", silhouette: "bridge", collection: "spans" },
    { id: "new-york", city: "New York", landmark: "Chrysler Building", silhouette: "tower", collection: "vertical" },
    { id: "barcelona", city: "Barcelona", landmark: "Sagrada Família", silhouette: "tower", collection: "vertical" },
    { id: "amsterdam", city: "Amsterdam", landmark: "Canal houses", silhouette: "horizontal", collection: "streets" },
    {
        id: "copenhagen",
        city: "Copenhagen",
        landmark: "Nyhavn waterfront houses",
        silhouette: "horizontal",
        collection: "streets"
    },
    { id: "istanbul", city: "Istanbul", landmark: "Hagia Sophia", silhouette: "dome", collection: "domes" },
    { id: "bangkok", city: "Bangkok", landmark: "Wat Arun", silhouette: "tower", collection: "east" },
    { id: "singapore", city: "Singapore", landmark: "Marina Bay Sands", silhouette: "horizontal", collection: "east" },
    { id: "dubai", city: "Dubai", landmark: "Burj Khalifa", silhouette: "tower", collection: "vertical" },
    { id: "sydney", city: "Sydney", landmark: "Sydney Opera House", silhouette: "sculpture", collection: "spans" },
    {
        id: "hong-kong",
        city: "Hong Kong",
        landmark: "Bank of China Tower",
        silhouette: "tower",
        collection: "vertical"
    },
    { id: "seoul", city: "Seoul", landmark: "Gyeongbokgung Palace", silhouette: "horizontal", collection: "east" },
    { id: "florence", city: "Florence", landmark: "Florence Cathedral", silhouette: "dome", collection: "domes" },
    { id: "venice", city: "Venice", landmark: "Rialto Bridge", silhouette: "bridge", collection: "spans" },
    { id: "prague", city: "Prague", landmark: "Charles Bridge", silhouette: "bridge", collection: "spans" },
    { id: "vienna", city: "Vienna", landmark: "Schönbrunn Palace", silhouette: "horizontal", collection: "streets" },
    {
        id: "budapest",
        city: "Budapest",
        landmark: "Hungarian Parliament Building",
        silhouette: "dome",
        collection: "domes"
    },
    { id: "lisbon", city: "Lisbon", landmark: "Belém Tower", silhouette: "tower", collection: "vertical" },
    { id: "berlin", city: "Berlin", landmark: "Brandenburg Gate", silhouette: "horizontal", collection: "streets" },
    { id: "athens", city: "Athens", landmark: "Parthenon", silhouette: "horizontal", collection: "streets" },
    { id: "marrakech", city: "Marrakech", landmark: "Koutoubia Mosque", silhouette: "tower", collection: "vertical" },
    { id: "cairo", city: "Cairo", landmark: "Pyramids of Giza", silhouette: "sculpture", collection: "spans" },
    {
        id: "rio-de-janeiro",
        city: "Rio de Janeiro",
        landmark: "Christ the Redeemer",
        silhouette: "sculpture",
        collection: "spans"
    },
    { id: "buenos-aires", city: "Buenos Aires", landmark: "Obelisco", silhouette: "tower", collection: "vertical" },
    {
        id: "mexico-city",
        city: "Mexico City",
        landmark: "Palacio de Bellas Artes",
        silhouette: "dome",
        collection: "domes"
    },
    { id: "stockholm", city: "Stockholm", landmark: "Stockholm City Hall", silhouette: "tower", collection: "vertical" }
] as const;

export type RoamLandmarkId = (typeof roamLandmarks)[number]["id"];
