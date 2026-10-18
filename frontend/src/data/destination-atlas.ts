import { editorialImage } from "../lib/image-library";
import type { CollageBoardCardData } from "@/types/board-card";

export type AtlasCategory = "Culture" | "Nature" | "Neighborhoods" | "Food";
export type AtlasImage = { src: string; alt: string; credit: string; sourceUrl: string; position?: string };
export type AtlasPlace = {
    id: string;
    name: string;
    category: AtlasCategory;
    neighborhood: string;
    coordinates: { latitude: number; longitude: number };
    image: AtlasImage;
    caption: string;
    story: string;
    note: string;
    sourceUrl: string;
};
export type DestinationPageData = {
    slug: string;
    name: string;
    country: string;
    nameLines?: [string, string];
    countryCode: string;
    aliases: string[];
    nativeName: string;
    edition: string;
    composition: "quiet" | "romantic" | "graphic";
    coordinates: { latitude: number; longitude: number };
    hero: AtlasImage;
    closingImage: AtlasImage;
    closingImageRotation?: number;
    introduction: string;
    opening?: { paragraphs: string[]; pins: string[]; tags: string[] };
    headline: [string, string];
    culture: { title: string; text: string };
    atmosphere: string[];
    seasons: { months: string; title: string; description: string }[];
    atlasTitle: [string, string];
    atlasIntroduction: string;
    places: AtlasPlace[];
    relatedBoards: (CollageBoardCardData & { href?: string })[];
    sources: { title: string; url: string }[];
};

const image = (file: string, alt: string, credit: string, photoId: string): AtlasImage => ({
    src: editorialImage(`/images/destinations/${file}.webp`),
    alt,
    credit,
    sourceUrl: `https://unsplash.com/photos/${photoId}`
});
const kyotoSource = "https://kyoto.travel/en/";
const parisSource = "https://parisjetaime.com/eng/";
const copenhagenSource = "https://www.visitcopenhagen.com/";
const kyotoHero: AtlasImage = {
    src: "library:frontend.images.destinations.kyoto.hero",
    alt: "The pagoda of Kiyomizu-dera above Kyoto, framed by a circle",
    credit: "Roamboard Figma reference",
    sourceUrl: "https://www.figma.com/design/4hUe6aKuQnp7zotBG7qqug/ROAMBOARD?node-id=55-1082"
};
const inari = image(
    "inari",
    "Vermilion torii gates on a wooded path at Fushimi Inari",
    "Jeremy Goldberg",
    "AiC8MRukmBg"
);
const bamboo = image("bamboo", "A path between tall green bamboo in Arashiyama", "Karen Chew", "EvsuNMbZNJw");
const nishiki = image("nishiki", "Colorful signs and shopfronts at Nishiki Market", "KJ Gonzales", "Mz_rFI4oq4I");
const pontocho = image(
    "pontocho",
    "Lanterns above a narrow lane in Pontocho after dark",
    "Stefan Szankowski",
    "gUg3rDj81ck"
);
const parisHero = image(
    "paris-hero",
    "The Eiffel Tower at the end of a Parisian street",
    "Diogo Fagundes",
    "dbBKeN1s8GY"
);
const palais = image(
    "palais",
    "Historic architecture and a fountain at Palais-Royal",
    "Anthony DELANOIX",
    "V5QILBs4jxA"
);
const montmartre = image(
    "montmartre",
    "A Parisian apartment building above a grassy slope in Montmartre",
    "Francesco Zivoli",
    "Qe5oPbc7pAo"
);
const seine = image("seine", "Boats on the Seine with the Grand Palais beyond", "Meina Yin", "xwPoexRGsXA");
const nyhavn = image("nyhavn", "Colorful Copenhagen houses and boats along Nyhavn", "Nick Karvounis", "z9omP7AT_2s");
const palms = image(
    "palms",
    "Palms beside a white stairway in Copenhagen’s Palm House",
    "Mykola Kolya Korzh",
    "3C3EYGhWr9Q"
);
const superkilen = image(
    "superkilen",
    "A child on the graphic white lines of Superkilen park",
    "Sam Poullain",
    "TuAZPj1uaZs"
);
const market = image(
    "market",
    "Fresh vegetables at Copenhagen’s Torvehallerne market",
    "Simone Pellegrini",
    "ZFkrPuz6EdI"
);

// Editorial mock guides, not persisted destinations, activity IDs, or live recommendations.
// Coordinates are place references for external maps; adding to a Board still requires its real location flow.
const editorialGuides: DestinationPageData[] = [
    {
        slug: "kyoto",
        name: "Kyoto",
        nativeName: "京都",
        country: "Japan",
        countryCode: "JPN",
        aliases: ["Kyōto"],
        edition: "01",
        composition: "quiet",
        coordinates: { latitude: 35.0116, longitude: 135.7681 },
        hero: kyotoHero,
        closingImage: {
            ...kyotoHero,
            src: "library:frontend.images.destinations.kyoto.closing",
            alt: "A lantern-lit Kyoto street within a circular composition",
            sourceUrl: "https://www.figma.com/design/4hUe6aKuQnp7zotBG7qqug/ROAMBOARD?node-id=740-1953"
        },
        closingImageRotation: 90,
        introduction:
            "Once Japan’s imperial capital, Kyoto is a city where centuries-old temples, peaceful gardens, traditional wooden streets, and vibrant local culture come together. From the historic lanes of Gion to hidden cafés, seasonal landscapes, and renowned cuisine, Kyoto offers a slower, more atmospheric side of Japan while still feeling lively and deeply connected to the present.",
        // Verbatim text from Figma, Roam Page 4.3.1 (Destination loaded), 55:1060.
        opening: {
            paragraphs: [
                "Kyoto’s food culture reflects the city itself: thoughtful, seasonal, and deeply rooted in tradition. Meals often celebrate simplicity, allowing a few carefully chosen ingredients to speak for themselves. From refined kaiseki dinners and delicate wagashi sweets to steaming bowls of ramen, tiny izakayas, tofu restaurants and bustling market stalls, eating here can feel as much like discovering the city as visiting its temples.",
                "Tea is woven into everyday life, with matcha appearing everywhere from centuries-old teahouses to contemporary cafés. Around Nishiki Market, narrow passages are filled with pickles, spices, sweets and local specialties, while after dark, lantern-lit streets around Gion and Pontocho reveal intimate restaurants and bars tucked behind wooden façades.",
                "There’s a quietness to Kyoto’s atmosphere that rewards taking your time. Wake early for nearly empty temple grounds, wander residential streets without a destination, stop somewhere small for tea, and let the city unfold between the places you planned to see. Kyoto is often at its most memorable in these slower moments — somewhere between tradition, everyday life and the changing seasons."
            ],
            pins: [
                "Fushimi Inari Taisha - famous for its thousands of red torii gates",
                "Yasaka Shrine - major shrine at the edge of Gion",
                "Kiyomizu-dera - hillside temple with sweeping city views",
                "Kinkaku-ji (Golden Pavilion) - the gold-covered Zen temple",
                "Gion - historic streets, teahouses, and traditional architecture",
                "Nishiki Market - great for street food and local specialties",
                "Nijō Castle - historic castle and gardens in central Kyoto"
            ],
            tags: ["ancient capital", "autumn colors", "walkable", "slow travel", "food"]
        },
        headline: ["A little slower.", "A little deeper."],
        culture: {
            title: "Between the places you planned.",
            text: "Kyoto lives in the details: a wooden doorway, the change of light in a garden, a bowl made for the season. Beyond its temples, everyday rituals give the city its rhythm. Leave room for the unplanned, and take your time with what you find."
        },
        atmosphere: ["serene", "layered", "traditional", "contemplative"],
        seasons: [
            {
                months: "MAR—MAY",
                title: "The city in bloom",
                description:
                    "Spring brings fresh green and cherry blossoms. Flowering dates vary each year; popular places can be busy."
            },
            {
                months: "OCT—NOV",
                title: "A change of color",
                description:
                    "Cooler days and autumn foliage. Color varies by altitude and weather, often arriving later in the city."
            },
            {
                months: "DEC—FEB",
                title: "The quieter season",
                description:
                    "Crisp air, bare branches and a different kind of stillness. Bring layers for cold mornings."
            }
        ],
        atlasTitle: ["The art of", "getting lost."],
        atlasIntroduction:
            "A few places to begin. No required order, no perfect route. Follow whatever catches your eye.",
        places: [
            {
                id: "kyoto-fushimi-inari",
                name: "Fushimi Inari",
                category: "Culture",
                neighborhood: "Fushimi",
                coordinates: { latitude: 34.9671, longitude: 135.7727 },
                image: inari,
                caption: "A thousand gates. Your own way through.",
                story: "Vermilion gates trace a path into the wooded slopes of Mount Inari. Step beyond the first sweep of torii and the rhythm changes: stone steps, smaller shrines, a pause beneath the trees. Choose how far to wander; the mountain is part of the experience.",
                note: "This is an active shrine. Keep paths clear, respect worshippers and leave time for the climb.",
                sourceUrl: "https://inari.jp/en/"
            },
            {
                id: "kyoto-arashiyama",
                name: "Arashiyama",
                category: "Nature",
                neighborhood: "Western Kyoto",
                coordinates: { latitude: 35.017, longitude: 135.671 },
                image: bamboo,
                caption: "Look up. Let the city fall away.",
                story: "Bamboo rises overhead, shifting the light into a soft green canopy. The grove is only one beginning: paths lead toward gardens, riverside walks and the wooded edges of western Kyoto. Give the surrounding neighborhood as much attention as the famous passage.",
                note: "Stay on public paths and avoid touching or marking the bamboo.",
                sourceUrl: kyotoSource
            },
            {
                id: "kyoto-nishiki",
                name: "Nishiki Market",
                category: "Food",
                neighborhood: "Central Kyoto",
                coordinates: { latitude: 35.005, longitude: 135.7649 },
                image: nishiki,
                caption: "Discover a city through its appetite.",
                story: "Under a long covered arcade, Kyoto’s food culture gathers in small, vivid details: pickles, tea, sweets and ingredients for the everyday table. Browse slowly, ask questions and stop at the stalls that draw you in. This is a working market as well as a place to explore.",
                note: "Eat in the spaces provided by each shop and be considerate of shoppers passing through.",
                sourceUrl: "https://www.kyoto-nishiki.or.jp/en/"
            },
            {
                id: "kyoto-pontocho",
                name: "Pontocho",
                category: "Neighborhoods",
                neighborhood: "Beside the Kamo River",
                coordinates: { latitude: 35.0064, longitude: 135.7708 },
                image: pontocho,
                caption: "When the lanterns begin to glow.",
                story: "A narrow lane beside the river becomes a study in warm light and wooden façades. Restaurants sit behind modest entrances, and the city feels close enough to hear. Walk through, find a place that welcomes you, or turn toward the river for a quieter evening.",
                note: "Respect private entrances and posted photography guidance. The surrounding streets are also people’s homes.",
                sourceUrl: kyotoSource
            }
        ],
        relatedBoards: [],
        sources: [{ title: "Kyoto City Official Guide", url: kyotoSource }]
    },
    {
        slug: "paris",
        name: "Paris",
        nativeName: "Paris",
        country: "France",
        countryCode: "FRA",
        aliases: [],
        edition: "02",
        composition: "romantic",
        coordinates: { latitude: 48.8566, longitude: 2.3522 },
        hero: parisHero,
        closingImage: seine,
        introduction:
            "A table on the pavement. A turn down the wrong street. The Paris you remember is often the one you never planned to find.",
        headline: ["Take the long way.", "Stay for another."],
        culture: {
            title: "Make an afternoon of it.",
            text: "Art spills out of museums into courtyards, bookshops and the everyday theatre of a café terrace. Cross the river without a hurry. Let a neighborhood become familiar. The grand gestures are here, but so are a thousand smaller reasons to stay."
        },
        atmosphere: ["expressive", "romantic", "lived-in", "curious"],
        seasons: [
            {
                months: "APR—JUN",
                title: "Out on the terrace",
                description:
                    "Longer days, gardens waking up and changeable spring weather. Leave room for a rainy museum afternoon."
            },
            {
                months: "SEP—OCT",
                title: "Back to the city",
                description: "Autumn light and cooler walks by the Seine. Pack a layer for the evenings."
            },
            {
                months: "NOV—FEB",
                title: "An indoor kind of magic",
                description:
                    "Shorter days invite galleries, covered passages and long café stops. Expect chilly weather."
            }
        ],
        atlasTitle: ["An invitation", "to wander."],
        atlasIntroduction: "A courtyard, a hillside, a river. Find your own connections between them.",
        places: [
            {
                id: "paris-palais-royal",
                name: "Palais-Royal",
                category: "Culture",
                neighborhood: "1st arrondissement",
                coordinates: { latitude: 48.864, longitude: 2.337 },
                image: palais,
                caption: "A different kind of rhythm.",
                story: "Striped columns interrupt a formal courtyard. Beyond them, arcades and a garden offer another pace entirely. Pause between the ordered architecture and playful contemporary art, then choose a passage back into the city.",
                note: "The courtyard and gardens are shared public spaces; follow posted access information.",
                sourceUrl: parisSource
            },
            {
                id: "paris-montmartre",
                name: "Montmartre",
                category: "Neighborhoods",
                neighborhood: "18th arrondissement",
                coordinates: { latitude: 48.8867, longitude: 2.3431 },
                image: montmartre,
                caption: "The city, a little above itself.",
                story: "Stairs and sloping streets lead toward Sacré-Cœur and views across the rooftops. Wander away from the busiest square and the neighborhood becomes smaller: corners, cafés, a doorway worth noticing. The climb is a good reason to take your time.",
                note: "Expect hills and steps. Choose a gentler route or local transport if needed.",
                sourceUrl: parisSource
            },
            {
                id: "paris-seine",
                name: "Along the Seine",
                category: "Nature",
                neighborhood: "The riverbanks",
                coordinates: { latitude: 48.863, longitude: 2.313 },
                image: seine,
                caption: "Let the river set the pace.",
                story: "Bridges frame the city in changing combinations of stone, sky and water. Follow a stretch of riverbank, stop to watch the boats, and cross when the other side looks inviting. There is no need to make a full circuit.",
                note: "Riverside access can change with water levels and events. Check local signs.",
                sourceUrl: parisSource
            },
            {
                id: "paris-eiffel",
                name: "Around the Eiffel Tower",
                category: "Culture",
                neighborhood: "7th arrondissement",
                coordinates: { latitude: 48.8584, longitude: 2.2945 },
                image: parisHero,
                caption: "A familiar silhouette. A new perspective.",
                story: "The tower appears between buildings before it fills the sky. Explore the surrounding streets and river crossings for your own view, then take a pause in the neighborhood. You don’t have to climb it to make it part of your Paris.",
                note: "Tower admission is separate from exploring the neighborhood. Check the official site for current access.",
                sourceUrl: "https://www.toureiffel.paris/en"
            }
        ],
        relatedBoards: [],
        sources: [{ title: "Paris je t’aime — Official tourism", url: parisSource }]
    },
    {
        slug: "copenhagen",
        name: "Copenhagen",
        nameLines: ["Copen", "hagen"],
        nativeName: "København",
        country: "Denmark",
        countryCode: "DNK",
        aliases: ["København", "Kobenhavn"],
        edition: "03",
        composition: "graphic",
        coordinates: { latitude: 55.6761, longitude: 12.5683 },
        hero: nyhavn,
        closingImage: palms,
        introduction:
            "Clear lines. Colorful edges. A city made for everyday pleasures, best discovered at the speed of a bicycle—or a very long lunch.",
        headline: ["Less hurry.", "More everyday."],
        culture: {
            title: "Good design is a way of life.",
            text: "Copenhagen’s pleasures are often practical: a waterside bench, a well-made cup, a cycle lane that takes you somewhere new. Move between harbor light, neighborhood markets and unexpected green spaces. There is beauty in how the ordinary things fit together."
        },
        atmosphere: ["playful", "considered", "open-air", "easygoing"],
        seasons: [
            {
                months: "MAY—AUG",
                title: "Stay out a little longer",
                description:
                    "Long daylight hours make room for waterfront walks and outdoor city life. Bring a layer for the breeze."
            },
            {
                months: "SEP—OCT",
                title: "A softer light",
                description: "Cooler days and autumn color. Mix outdoor exploring with cafés and museums."
            },
            {
                months: "NOV—FEB",
                title: "Warmth from within",
                description: "Short days, candlelit cafés and winter walks. Dress for cold, wind and possible rain."
            }
        ],
        atlasTitle: ["Well designed.", "Freely explored."],
        atlasIntroduction: "From harbor colors to graphic playgrounds. A small collection of everyday extraordinary.",
        places: [
            {
                id: "copenhagen-nyhavn",
                name: "Nyhavn",
                category: "Neighborhoods",
                neighborhood: "Inner city",
                coordinates: { latitude: 55.6798, longitude: 12.5909 },
                image: nyhavn,
                caption: "Color, reflected.",
                story: "Painted façades line the old harbor, their colors broken into small ripples by passing boats. Walk along the water, then step into the surrounding streets. The postcard view is a lovely beginning, rather than the whole story.",
                note: "The harbor is a busy shared space. Leave room for pedestrians and watch for cycle lanes nearby.",
                sourceUrl: "https://www.visitcopenhagen.com/copenhagen/planning/nyhavn-gdk474735"
            },
            {
                id: "copenhagen-palm-house",
                name: "The Palm House",
                category: "Nature",
                neighborhood: "Botanical Garden",
                coordinates: { latitude: 55.686, longitude: 12.5731 },
                image: palms,
                caption: "A little further from the everyday.",
                story: "Glass, white ironwork and layers of tropical green create a small world inside the city. Study a leaf, trace a staircase with your eyes, and let the outdoor pace dissolve. The surrounding Botanical Garden offers another way to linger.",
                note: "Check the garden’s official visitor information for current Palm House opening and admission.",
                sourceUrl: "https://snm.dk/en/udstilling/palm-house"
            },
            {
                id: "copenhagen-superkilen",
                name: "Superkilen",
                category: "Culture",
                neighborhood: "Nørrebro",
                coordinates: { latitude: 55.6993, longitude: 12.5422 },
                image: superkilen,
                caption: "The city as a playground.",
                story: "Graphic lines and objects from around the world turn a neighborhood park into a playful public composition. It is a place to move, meet and observe, where design belongs to everyday life rather than behind glass.",
                note: "This is a neighborhood space in daily use. Share it considerately with people playing and passing through.",
                sourceUrl: "https://superflex.net/works/superkilen"
            },
            {
                id: "copenhagen-torvehallerne",
                name: "Torvehallerne",
                category: "Food",
                neighborhood: "Near Nørreport",
                coordinates: { latitude: 55.6836, longitude: 12.5695 },
                image: market,
                caption: "Let lunch become the plan.",
                story: "Market stalls bring seasonal produce, something sweet and the possibility of a very good lunch into one place. Browse before choosing, find somewhere to pause, then head back into the neighborhood with no particular urgency.",
                note: "Stall opening hours vary. Check the market’s own information before a special trip.",
                sourceUrl: "https://torvehallernekbh.dk/"
            }
        ],
        relatedBoards: [],
        sources: [{ title: "Visit Copenhagen — Official guide", url: copenhagenSource }]
    }
];

// Editorial sample content is adapted to shared V4; it has no persisted IDs or detail links.
export const destinationPages: DestinationPageData[] = editorialGuides.map((destination) => ({
    ...destination,
    relatedBoards: [
        {
            title: "The slower way",
            lines: ["The slower", "way"],
            description: `Taking time for the small discoveries in ${destination.name}. A few places, and room for the unexpected.`
        },
        {
            title: "A few good days",
            lines: ["A few", "good days"],
            description: `A little culture, a neighborhood walk and an afternoon with no particular plan. ${destination.name}, at our own pace.`
        },
        {
            title: "Between the landmarks",
            lines: ["Between the", "landmarks"],
            description: `Finding a different side of ${destination.name}, one quiet corner and unplanned detour at a time.`
        }
    ].map((sample, index) => ({
        id: `sample-${destination.slug}-${index}`,
        title: sample.title,
        titleLines: sample.lines,
        author: "Roamboard editorial sample",
        destination: `${destination.name}, ${destination.country}`,
        destinationLabel: destination.countryCode,
        durationDays: index + 2,
        description: sample.description,
        themes: [],
        highlights: destination.places.slice(0, 3).map((place) => place.name),
        images: Array.from(
            { length: 6 },
            (_, photoIndex) => destination.places[(photoIndex + index) % destination.places.length].image
        )
    }))
}));

export function getDestinationPage(slug: string) {
    return destinationPages.find((destination) => destination.slug === slug);
}

export function destinationPageHref(destination: Pick<DestinationPageData, "slug">) {
    return `/discover/destinations/${encodeURIComponent(destination.slug)}`;
}

const normalize = (value: string) =>
    value
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("en");
export function findDestinationPage(place: {
    name?: string | null;
    city?: string | null;
    countryCode?: string | null;
    placeType?: string;
}) {
    const countryCode = place.countryCode?.trim().toUpperCase();
    if (!countryCode || (place.placeType && place.placeType !== "place")) return undefined;
    return destinationPages.find((destination) => {
        const names = [destination.name, ...destination.aliases].map(normalize);
        const city = normalize(place.city || "");
        return (
            destination.countryCode === countryCode &&
            names.includes(normalize(place.name || "")) &&
            (!city || names.includes(city))
        );
    });
}
