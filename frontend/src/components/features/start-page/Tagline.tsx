const LINES = [
  "*ROAMBOARD IS A VISUAL TRAVEL PLATFORM",
  "FOR DISCOVERING PLACES, FINDING",
  "INSPIRATION, AND TURNING",
  "THE THINGS YOU LOVE",
  "INTO JOURNEYS OF",
  "YOUR OWN",
];

export default function Tagline() {
  return (
    <p className="absolute right-0 top-0 p-3 text-right font-body text-10 font-normal uppercase leading-[1.25] sm:text-12">
      {LINES.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}
