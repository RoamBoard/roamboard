const LINES = [
    "*ROAMBOARD IS A VISUAL TRAVEL PLATFORM",
    "FOR DISCOVERING PLACES, FINDING",
    "INSPIRATION, AND TURNING",
    "THE THINGS YOU LOVE",
    "INTO JOURNEYS OF",
    "YOUR OWN"
];

export default function Tagline() {
    return (
        <p className="font-body text-10 sm:text-12 absolute top-0 right-0 p-3 text-right leading-[1.25] font-normal uppercase">
            {LINES.map((line) => (
                <span key={line} className="block">
                    {line}
                </span>
            ))}
        </p>
    );
}
