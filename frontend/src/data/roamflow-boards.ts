import { collageBoardExamples, landscapeBoardExamples, photoBoardExamples } from "@/data/board-card-examples";
import { roamFlowPageSize, type RoamFlowBoard, type RoamFlowPage } from "@/lib/roamflow";

const image = (name: string, alt: string) => ({ src: `/images/roamflow/${name}.webp`, alt });

// Fictional editorial stories using existing photographs. No records are created or persisted.
// The original V4 references lead the collection; only the existing Tokyo viewer has a navigation target.
export const roamFlowBoards: readonly RoamFlowBoard[] = [
    ...photoBoardExamples,
    {
        id: "lost-in-tokyo",
        title: "Lost in Tokyo",
        titleLines: ["Lost in", "Tokyo"],
        author: "Maya",
        destination: "Tokyo, Japan",
        destinationLabel: "JPN",
        image: { src: "/images/boards/night-street.jpg", alt: "A Tokyo street filled with people and neon signs" },
        href: "/boards/lost-in-tokyo"
    },
    { ...landscapeBoardExamples[2], id: "flow-marrakech" },
    {
        ...collageBoardExamples[1],
        id: "flow-paris",
        image: image("v1-paris-frame40", "Eiffel Tower from a Paris street"),
        labelOffset: 40.75
    },
    {
        ...collageBoardExamples[2],
        id: "flow-bangkok",
        titleLines: ["Bangkok before", "breakfast"],
        image: image("v1-bangkok-frame40", "Tuk-tuk beside a Bangkok temple"),
        labelOffset: 40.75
    },
    { ...landscapeBoardExamples[0], id: "flow-buenos-aires", labelOffset: 40.75 },
    { ...landscapeBoardExamples[1], id: "flow-odda", labelOffset: 36 },
    {
        id: "flow-fuji",
        title: "The Mountain Waits",
        titleLines: ["The Mountain", "Waits"],
        author: "Ren Takahashi",
        destination: "Fujiyoshida, Japan",
        destinationLabel: "JPN",
        image: image("v1-tokyo-frame43", "Mount Fuji behind a pagoda")
    },
    {
        id: "flow-louvre",
        title: "One More Room",
        titleLines: ["One More", "Room"],
        author: "Amélie Laurent",
        destination: "Paris, France",
        destinationLabel: "FRA",
        image: image("v1-paris-frame41", "The glass pyramid of the Louvre")
    },
    {
        id: "flow-neon",
        title: "The Last Train Can Wait",
        titleLines: ["The Last Train", "Can Wait"],
        author: "Oliver Chen",
        destination: "Tokyo, Japan",
        destinationLabel: "JPN",
        image: image("v1-tokyo-frame41", "Neon signs above a Tokyo street")
    },
    {
        id: "flow-yaowarat",
        title: "Dinner, Then Another",
        titleLines: ["Dinner, Then", "Another"],
        author: "Narin Sutham",
        destination: "Bangkok, Thailand",
        destinationLabel: "THA",
        image: image("v1-bangkok-frame43", "Bangkok street food stalls glowing at night")
    },
    {
        id: "flow-paris-cafe",
        title: "A Table for the Afternoon",
        titleLines: ["A Table for", "the Afternoon"],
        author: "Léa Moreau",
        destination: "Paris, France",
        destinationLabel: "FRA",
        image: image("v1-paris-frame42", "A Parisian café opening onto the street")
    },
    {
        id: "flow-arun",
        title: "Across the River",
        titleLines: ["Across the", "River"],
        author: "Pim Charoen",
        destination: "Bangkok, Thailand",
        destinationLabel: "THA",
        image: image("v1-bangkok-frame41", "Wat Arun beside the Chao Phraya River")
    },
    {
        id: "flow-asakusa",
        title: "Before the City Wakes",
        titleLines: ["Before the", "City Wakes"],
        author: "Hana Mori",
        destination: "Asakusa, Japan",
        destinationLabel: "JPN",
        image: { src: "/images/boards/temple.jpg", alt: "Visitors in the grounds of Senso-ji" }
    },
    {
        id: "flow-seine",
        title: "Follow the Seine",
        titleLines: ["Follow", "the Seine"],
        author: "Jules Bernard",
        destination: "Paris, France",
        destinationLabel: "FRA",
        image: image("v1-paris-frame44", "The Eiffel Tower beside the Seine")
    },
    {
        id: "flow-tokyo-coffee",
        title: "Coffee, Slowly",
        titleLines: ["Coffee,", "Slowly"],
        author: "Emi Watanabe",
        destination: "Tokyo, Japan",
        destinationLabel: "JPN",
        image: { src: "/images/boards/cafe.jpg", alt: "A Tokyo café with wooden tables and warm light" }
    },
    {
        id: "flow-bangkok-water",
        title: "When the River Turns Gold",
        titleLines: ["When the River", "Turns Gold"],
        author: "Sofia Mendes",
        destination: "Bangkok, Thailand",
        destinationLabel: "THA",
        image: image("v1-bangkok-frame42", "Lights reflected on the Bangkok river at night")
    },
    {
        id: "flow-paris-arc",
        title: "All Roads, Eventually",
        titleLines: ["All Roads,", "Eventually"],
        author: "Gabriel Roux",
        destination: "Paris, France",
        destinationLabel: "FRA",
        image: image("v1-paris-frame45", "The Arc de Triomphe in Paris")
    },
    {
        id: "flow-tokyo-lanterns",
        title: "Under the Lanterns",
        titleLines: ["Under the", "Lanterns"],
        author: "Alex Rivera",
        destination: "Tokyo, Japan",
        destinationLabel: "JPN",
        image: image("v1-tokyo-frame42", "Red lanterns illuminating a Tokyo street")
    },
    {
        id: "flow-tokyo-tower",
        title: "Looking Up Again",
        titleLines: ["Looking Up", "Again"],
        author: "Yuki Sato",
        destination: "Tokyo, Japan",
        destinationLabel: "JPN",
        image: image("v1-tokyo-frame40", "Tokyo Tower against a cloudy sky")
    },
    {
        id: "flow-bangkok-spires",
        title: "Above the Rooftops",
        titleLines: ["Above the", "Rooftops"],
        author: "Anong Prasert",
        destination: "Bangkok, Thailand",
        destinationLabel: "THA",
        image: image("v1-bangkok-frame44", "Ornate temple spires in Bangkok")
    },
    {
        id: "flow-tokyo-pagoda",
        title: "A Quieter Kind of Red",
        titleLines: ["A Quieter", "Kind of Red"],
        author: "Clara Jensen",
        destination: "Japan",
        destinationLabel: "JPN",
        image: image("v1-tokyo-frame45", "The red tiers of a Japanese pagoda")
    },
    {
        id: "flow-bangkok-evening",
        title: "The Warmest Hour",
        titleLines: ["The Warmest", "Hour"],
        author: "Daniel Park",
        destination: "Bangkok, Thailand",
        destinationLabel: "THA",
        image: image("v1-bangkok-frame45", "A Bangkok street in warm evening light")
    },
    {
        id: "flow-tokyo-neighbourhood",
        title: "One Street Further",
        titleLines: ["One Street", "Further"],
        author: "Isabel Costa",
        destination: "Tokyo, Japan",
        destinationLabel: "JPN",
        image: { src: "/images/boards/neighbourhood.jpg", alt: "A cyclist passing a Tokyo coffee shop" }
    },
    {
        id: "flow-paris-art",
        title: "Stay a Little Longer",
        titleLines: ["Stay a Little", "Longer"],
        author: "Camille Petit",
        destination: "Paris, France",
        destinationLabel: "FRA",
        image: image("v1-paris-frame43", "Visitors studying the Mona Lisa at the Louvre")
    },
    {
        id: "flow-tokyo-alley",
        title: "Somewhere Off the Map",
        titleLines: ["Somewhere", "Off the Map"],
        author: "Sam Okafor",
        destination: "Tokyo, Japan",
        destinationLabel: "JPN",
        image: image("v1-tokyo-frame44", "A narrow Tokyo alley at night")
    }
];

export const roamFlowInitialPage: RoamFlowPage = {
    boards: roamFlowBoards.slice(0, roamFlowPageSize),
    nextCursor: roamFlowBoards.length > roamFlowPageSize ? String(roamFlowPageSize) : null
};
