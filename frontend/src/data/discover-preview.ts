// Visual preview fixtures, not a Discover API contract or live popularity data.
// URLs come from the user's Unsplash list; collection alternatives were approved.
export type DiscoverPhoto = {
    src: string;
    alt: string;
    sourceUrl: string;
    photographer?: string;
    photographerUrl?: string;
};

function photo(
    image: string,
    alt: string,
    page?: string,
    photographer?: string,
    username?: string
): DiscoverPhoto {
    const src = `https://images.unsplash.com/photo-${image}?auto=format&fit=crop&w=1200&q=80&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D`;
    return {
        src,
        alt,
        sourceUrl: page
            ? `https://unsplash.com/photos/${page}?utm_source=roamboard&utm_medium=referral`
            : src,
        photographer,
        photographerUrl: username
            ? `https://unsplash.com/@${username}?utm_source=roamboard&utm_medium=referral`
            : undefined
    };
}

export const discoverPhotos = {
    kyoto: photo(
        "1578469645742-46cae010e5d4",
        "Kiyomizu-dera pagoda above the trees and rooftops of Kyoto"
    ),
    aurora: photo(
        "1517411032315-54ef2cb783bb",
        "Green northern lights above a quiet shoreline"
    ),
    surf: photo(
        "1612025344470-df9818c785a4",
        "Surfers waiting in a blue sea at dusk"
    ),
    goldenSurf: photo(
        "1789014538596-16dc5e095fef",
        "A surfer riding golden waves in the evening light"
    ),
    sunsetFriends: photo(
        "1598842582612-ea95bca731f9",
        "Friends silhouetted against an orange sunset"
    ),
    cave: photo(
        "1464809142576-df63ca4ed7f0",
        "Sunlight entering a moss-covered cave"
    ),
    woodlandFriends: photo(
        "1597056161974-458b172dac56",
        "Friends beside a forest overlooking the sunset"
    ),
    summit: photo(
        "1551740994-7af69385a217",
        "A traveller on a rocky summit beneath the evening sky",
        "__I-gX-cnd8",
        "David Billings",
        "dav_billings"
    ),
    fog: photo(
        "1704129661536-3897d38550a0",
        "A hiker disappearing into mountain mist",
        "b258hHqfGAY",
        "Martin Marek",
        "martys111"
    ),
    beachFriends: photo(
        "1617819617162-aefecdc0b3f4",
        "Friends walking together at sunset",
        "LhY8gh5_u_g",
        "Hester Qiang"
    ),
    oceanSunset: photo(
        "1777236912305-19854c4f0592",
        "A person watching the sunset from the ocean shore",
        "6tw06nqC5M0",
        "Liosha Shyp",
        "liosha_shyp"
    ),
    stars: photo(
        "1734545503371-9a45282044d8",
        "A hiker under a sky filled with stars",
        "LUrr8X4RDw4",
        "Filip Kvasnak",
        "filipkvasnak"
    ),
    couple: photo(
        "1521033719794-41049d18b8d4",
        "Two people embracing against an orange sky",
        "DJ_kZaITX78",
        "Abdul Gani M",
        "abdu27"
    ),
    desert: photo(
        "1698759087677-15695e656630",
        "A camel rider crossing sunlit desert dunes",
        "HQaZKCDaax0",
        "Shreyas Sane",
        "shreyasdbz"
    ),
    fireworks: photo(
        "1735845735730-88451aaea9f1",
        "Friends watching green fireworks from a hillside",
        "wYIPMppRSr0",
        "Jahanzeb Ahsan",
        "jahan_photobox"
    ),
    france: photo(
        "1609971757431-439cf7b4141b",
        "The Eiffel Tower seen from a Parisian street",
        "dbBKeN1s8GY",
        "Diogo Fagundes"
    ),
    brazil: photo(
        "1705937565504-212dd419fda3",
        "Christ the Redeemer overlooking Rio de Janeiro",
        "btMkMSJQxMc",
        "Daniel de Paola",
        "dpaola"
    ),
    morocco: photo(
        "1559664135-17e2817d1cdb",
        "A Moroccan city at sunset",
        "-jXBD4xogXE",
        "Miltiadis Fragkidis",
        "_miltiadis_"
    ),
    japan: photo(
        "1601823984263-b87b59798b70",
        "A red torii gate along a forest path in Hakone",
        "kaoHI0iHJPM",
        "Syuhei Inoue",
        "_______life_"
    ),
    thailand: photo(
        "1528181304800-259b08848526",
        "Ornate temples and statues in northern Thailand",
        "gsllxmVO4HQ",
        "Mathew Schwartz",
        "cadop"
    ),
    korea: photo(
        "1599033769063-fcd3ef816810",
        "The ornate eaves of Gyeongbokgung Palace",
        "Via0Hy2rYIc",
        "Alexandre Trouvé",
        "alexandretrouve"
    ),
    indonesia: photo(
        "1575573330964-db3dad170190",
        "A traveller between the gates of Lempuyang Temple",
        "oVvs_K4Bja4",
        "Khamkéo",
        "mahkeo"
    ),
    spain: photo(
        "1512753360435-329c4535a9a7",
        "The warm evening light over Málaga",
        "7vKP5BAm8wg",
        "Willian Justen de Vasconcellos",
        "willianjusten"
    ),
    odda: photo(
        "1582920771007-0a1080b99a31",
        "Snow-covered Odda beside a Norwegian fjord",
        "aOpfB0kGNNk",
        "Lachlan Gowen",
        "lachlangowen"
    ),
    marrakech: photo(
        "1640263408299-8972236d0590",
        "The Koutoubia mosque in Marrakech",
        "OZXMG7bQ-Kc",
        "Mehdi El marouazi"
    ),
    buenosAires: photo(
        "1572181330858-13fd026f94a9",
        "The domed Congress building in Buenos Aires",
        "Atc4GkwqifA",
        "Manuel Cortina",
        "mct1997"
    ),
    hiddenGems: photo(
        "1536152470836-b943b246224c",
        "A moonlit mountain beyond a forest in Bali",
        "LSFuPFE9vKE",
        "Aron Visuals",
        "aronvisuals"
    ),
    // Selected alternatives for collection photos missing from the supplied list.
    nightlife: photo(
        "1713450605007-814dd58d6a6f",
        "A night out illuminated by red and blue lights",
        "oGPDjgouwoA",
        "Nereid Ndreu",
        "nereiq"
    ),
    mornings: photo(
        "1542372147193-a7aca54189cd",
        "Coffee, a croissant and a book at a quiet café",
        "1k7TnX5GAww",
        "Rizky Subagja"
    ),
    food: photo(
        "1763867641433-e7d2c0f62361",
        "Colourful dishes shared around a restaurant table",
        "rlClfxPYxQM",
        "Neon Wang",
        "neonwangphotography"
    ),
    quiet: photo(
        "1757916797439-f001c3b20716",
        "Sunbeams falling across an empty forest road",
        "MTJkXs1DfCw",
        "Pascal Debrunner"
    ),
    water: photo(
        "1772331250367-ebfca0ae9f75",
        "A pine-framed path beside the Adriatic Sea",
        "KG3UUwvhpAs",
        "Riley Crawford",
        "ricrawfo"
    )
};

export const journeyColumns = [
    { offset: -8, photos: [discoverPhotos.aurora, discoverPhotos.goldenSurf] },
    {
        offset: -35,
        photos: [
            discoverPhotos.surf,
            discoverPhotos.sunsetFriends,
            discoverPhotos.cave
        ]
    },
    {
        offset: -3,
        photos: [discoverPhotos.woodlandFriends, discoverPhotos.summit]
    },
    {
        offset: -23,
        photos: [
            discoverPhotos.fog,
            discoverPhotos.beachFriends,
            discoverPhotos.beachFriends
        ]
    },
    { offset: -9, photos: [discoverPhotos.oceanSunset, discoverPhotos.stars] },
    {
        offset: -27,
        photos: [
            discoverPhotos.couple,
            discoverPhotos.desert,
            discoverPhotos.fireworks
        ]
    }
];

export const previewCollections = [
    {
        title: "Nightlife",
        lines: ["NIGHT-", "LIFE"],
        description: "Rooftops, hidden bars, and places worth staying out for.",
        photo: discoverPhotos.nightlife,
        layout: "md:col-span-6 md:row-span-2",
        large: true
    },
    {
        title: "Slow mornings",
        lines: ["SLOW", "MORNINGS"],
        description:
            "Fresh pastries, neighborhood cafés, and taking the long way into the day.",
        photo: discoverPhotos.mornings,
        layout: "md:col-span-4"
    },
    {
        title: "By the water",
        lines: ["BY THE", "WATER"],
        description: "Sea air, slow walks, and places to sit for a while.",
        photo: discoverPhotos.water,
        layout: "md:col-span-2"
    },
    {
        title: "Food, and more food",
        lines: ["FOOD, AND", "MORE FOOD"],
        description:
            "Local favorites, late dinners, and always room for dessert.",
        photo: discoverPhotos.food,
        layout: "md:col-span-3"
    },
    {
        title: "Somewhere quiet",
        lines: ["SOMEWHERE", "QUIET"],
        description:
            "Hidden corners, empty paths, and somewhere the noise doesn’t follow.",
        photo: discoverPhotos.quiet,
        layout: "md:col-span-3"
    }
];

export const previewDestinations = [
    {
        name: "France",
        count: 217,
        photo: discoverPhotos.france,
        layout: "md:col-start-1 md:col-span-2 md:row-start-1 md:row-span-3"
    },
    {
        name: "Spain",
        count: 126,
        photo: discoverPhotos.spain,
        layout: "md:col-start-3 md:col-span-5 md:row-start-1 md:row-span-2"
    },
    {
        name: "Indonesia",
        count: 68,
        photo: discoverPhotos.indonesia,
        layout: "md:col-start-8 md:col-span-2 md:row-start-1 md:row-span-3"
    },
    {
        name: "South Korea",
        count: 89,
        photo: discoverPhotos.korea,
        layout: "md:col-start-10 md:col-span-3 md:row-start-1 md:row-span-3"
    },
    {
        name: "Brazil",
        count: 75,
        photo: discoverPhotos.brazil,
        layout: "md:col-start-1 md:col-span-2 md:row-start-4 md:row-span-3"
    },
    {
        name: "Japan",
        count: 104,
        photo: discoverPhotos.japan,
        layout: "md:col-start-3 md:col-span-2 md:row-start-3 md:row-span-3"
    },
    {
        name: "Morocco",
        count: 45,
        photo: discoverPhotos.morocco,
        layout: "md:col-start-5 md:col-span-3 md:row-start-3 md:row-span-3"
    },
    {
        name: "Thailand",
        count: 153,
        photo: discoverPhotos.thailand,
        layout: "md:col-start-8 md:col-span-5 md:row-start-4 md:row-span-2"
    }
];

export const previewBoards = [
    {
        id: "preview-marrakech",
        tags: ["culture", "hidden-gems", "markets", "wine-and-dine"],
        title: "Meet Me In Marrakech",
        author: "Ines Alaoui",
        code: "MAR",
        photo: discoverPhotos.marrakech,
        description:
            "A few colorful days getting lost among courtyards, winding streets and the beautiful chaos that makes Marrakech impossible to forget.",
        highlights: ["Medina wandering", "Rooftop dinners", "Market mornings"]
    },
    {
        id: "preview-odda",
        tags: [
            "nature",
            "mountains",
            "winter-escapes",
            "slow-mornings",
            "by-the-water"
        ],
        title: "Odda Season",
        author: "Natalie Foster",
        code: "NOR",
        photo: discoverPhotos.odda,
        description:
            "Snow-covered roads, quiet fjords and slow evenings spent warming up by the fire after a day out in the cold.",
        highlights: ["Slow mornings", "Fjord chasing", "Cosy cafés"]
    },
    {
        id: "preview-buenos-aires",
        tags: [
            "city-life",
            "foodie",
            "cafe-hopping",
            "nightlife",
            "architecture"
        ],
        title: "Buenos Días Buenos Aires",
        author: "Valentina Paz",
        code: "ARG",
        photo: discoverPhotos.buenosAires,
        description:
            "A few days getting swept up in the rhythm, character, food, culture and energy of the capital of Argentina.",
        highlights: ["Café mornings", "Steak dinners", "Tango nights"]
    }
];
