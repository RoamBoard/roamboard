import type {
    CollageBoardCardData,
    CompactBoardCardData,
    LandscapeBoardCardData,
    PhotoBoardCardData
} from "@/types/board-card";

// Visual fixtures from Figma Project Components; these are not persisted Boards.
const asset = (name: string, alt: string) => ({ src: `/images/board-cards/${name}.png`, alt });

export const collageBoardExamples: readonly CollageBoardCardData[] = [
    {
        id: "v1-tokyo",
        title: "Lost in Tokyo",
        titleLines: ["Lost in", "Tokyo"],
        author: "Noah Fischer",
        destination: "Tokyo, Japan",
        destinationLabel: "JPN",
        labelOffset: 44.773,
        durationDays: 4,
        descriptionWidth: 144,
        description: "Neon streets, tiny bars, late-night ramen and absolutely no idea which train exit\nto take.",
        themes: ["Neighborhoods", "Hidden bars", "Ramen"],
        highlights: [
            "Shibuya Crossing",
            "Sensō-ji",
            "Shimokitazawa",
            "Meiji Shrine Tsukiji",
            "Outer Market",
            "Golden Gai"
        ],
        savedCount: 1284,
        images: [
            asset("v1-tokyo-frame40", "Tokyo Tower"),
            asset("v1-tokyo-frame42", "Lanterns along a Tokyo street"),
            asset("v1-tokyo-frame45", "A red Japanese pagoda"),
            asset("v1-tokyo-frame44", "Tokyo alley at night"),
            asset("v1-tokyo-frame41", "Neon lights in Tokyo"),
            asset("v1-tokyo-frame43", "Mount Fuji behind a pagoda")
        ]
    },
    {
        id: "v1-paris",
        title: "Paris, obviously",
        titleLines: ["Paris,", "obviously"],
        author: "Chloe Martin",
        destination: "Paris, France",
        destinationLabel: "FRA",
        labelOffset: 44.091,
        durationDays: 3,
        descriptionWidth: 186,
        description:
            "Croissants for breakfast, wine by sunset and somehow another hour spent wandering streets we definitely didn’t mean to take.",
        themes: ["Café hopping", "Scenic lunches", "Late-night walks"],
        highlights: [
            "Montmartre",
            "Le Marais",
            "Palais Royal",
            "Canal Saint-Martin",
            "Jardin du Luxembourg",
            "Saint-Germain-des-Prés"
        ],
        savedCount: 1476,
        images: [
            asset("v1-paris-frame40", "Eiffel Tower from a Paris street"),
            asset("v1-paris-frame42", "A café in Paris"),
            asset("v1-paris-frame45", "Arc de Triomphe"),
            asset("v1-paris-frame44", "Eiffel Tower beside the Seine"),
            asset("v1-paris-frame41", "The Louvre pyramid"),
            asset("v1-paris-frame43", "Visitors viewing the Mona Lisa")
        ]
    },
    {
        id: "v1-bangkok",
        title: "Bangkok before breakfast",
        titleLines: ["Bangkok before", "breakfast"],
        author: "Mateo Reyes",
        destination: "Bangkok, Thailand",
        destinationLabel: "THA",
        labelOffset: 41.591,
        durationDays: 5,
        descriptionWidth: 192,
        description:
            "Street food at sunrise, temples before the heat and somehow already three iced coffees deep before most of the city has properly woken up.",
        themes: ["Night markets", "Temple hopping", "Street food"],
        highlights: ["Wat Arun", "Chinatown", "Chatuchak Market", "Talat Noi", "Wat Pho", "Yaowarat Road"],
        savedCount: 1932,
        images: [
            asset("v1-bangkok-frame40", "Tuk-tuk beside a Bangkok temple"),
            asset("v1-bangkok-frame42", "Bangkok river at night"),
            asset("v1-bangkok-frame45", "A Bangkok street in warm evening light"),
            asset("v1-bangkok-frame44", "Temple spires in Bangkok"),
            asset("v1-bangkok-frame41", "Wat Arun beside the river"),
            asset("v1-bangkok-frame43", "Bangkok street food stalls at night")
        ]
    }
];

export const compactBoardExamples: readonly CompactBoardCardData[] = collageBoardExamples.map((board, index) => ({
    id: board.id.replace("v1", "v2"),
    title: board.title,
    titleLines: index === 2 ? ["Bangkok", "before bre..."] : board.titleLines,
    author: board.author,
    destination: board.destination,
    destinationLabel: board.destinationLabel,
    footerOffset: [0, -1, 2.5][index],
    image: asset(`v2-${["tokyo", "paris", "bangkok"][index]}-ellipse1`, `${board.destination} photo`)
}));

export const landscapeBoardExamples: readonly LandscapeBoardCardData[] = [
    {
        id: "v3-buenos-aires",
        title: "Buenos Días Buenos Aires",
        titleLines: ["Buenos Días", "Buenos Aires"],
        author: "Valentina Paz",
        destination: "Buenos Aires, Argentina",
        destinationLabel: "ARG",
        referenceWidth: 760,
        image: asset("v3-buenos-aires-frame169", "The domed Argentine National Congress building"),
        description:
            "A few days getting swept up in the rhythm, character, food, culture and energy of the capital of Argentina.",
        descriptionLines: [
            "A few days getting swept up in the rhythm,",
            "character, food, culture and energy of",
            "the capital of Argentina."
        ],
        highlights: ["Café mornings", "Steak dinners", "Tango nights"]
    },
    {
        id: "v3-odda",
        title: "Odda Season",
        titleLines: ["Odda", "Season"],
        author: "Natalie Foster",
        destination: "Odda, Norway",
        destinationLabel: "NOR",
        image: asset("v3-odda-frame169", "Snow-covered houses beside the fjord in Odda"),
        description:
            "Snow-covered roads, quiet fjords and slow evenings spent warming up by the fire after a day out in the cold.",
        descriptionLines: [
            "Snow-covered roads, quiet fjords and",
            "slow evenings spent warming up by",
            "the fire after a day out in the cold."
        ],
        highlights: ["Slow mornings", "Fjord chasing", "Cosy cafés"]
    },
    {
        id: "v3-marrakech",
        title: "Meet Me In Marrakech",
        titleLines: ["Meet Me In", "Marrakech"],
        author: "Ines Alaoui",
        highlightFontSize: 12,
        destination: "Marrakech, Morocco",
        destinationLabel: "MAR",
        image: asset("v3-marrakech-frame169", "The Koutoubia Mosque in Marrakech"),
        description:
            "A few colorful days getting lost among courtyards, winding streets and the beautiful chaos that makes Marrakech impossible to forget.",
        descriptionLines: [
            "A few colorful days getting lost among courtyards,",
            "winding streets and the beautiful chaos that",
            "makes Marrakech impossible to forget."
        ],
        highlights: ["Medina wandering", "Rooftop dinners", "Market mornings"]
    }
];

export const photoBoardExamples: readonly PhotoBoardCardData[] = [
    {
        id: "v4-porto",
        title: "Postcards from Porto",
        titleLines: ["Postcards", "from Porto"],
        author: "Inês Carvalho",
        destination: "Porto, Portugal",
        destinationLabel: "POR",
        labelOffset: 40.75,
        image: {
            ...asset("v4-porto-frame172", "Sunset over the Douro River in Porto"),
            crop: { width: 313.73, height: 141.2, left: -0.1, top: 0 }
        }
    },
    {
        id: "v4-lofoten",
        title: "A Little Further North",
        titleLines: ["A Little Further", "North"],
        author: "Thea Kristiansen",
        destination: "Lofoten, Norway",
        destinationLabel: "NOR",
        labelOffset: 36,
        image: asset("v4-lofoten-frame172", "Red fishing cabins and rocky shoreline in Lofoten")
    },
    {
        id: "v4-barcelona",
        title: "Barcelona After Bedtime",
        titleLines: ["Barcelona After", "Bedtime"],
        author: "Marisol Vega",
        destination: "Barcelona, Spain",
        destinationLabel: "SPA",
        labelOffset: 51,
        image: asset("v4-barcelona-frame172", "Casa Batlló illuminated at night in Barcelona")
    }
];
