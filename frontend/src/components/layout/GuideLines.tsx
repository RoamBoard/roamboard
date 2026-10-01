export default function GuideLines() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
        >
            <div className="bg-slate absolute inset-y-0 left-[2.25%] w-px" />
            <div className="bg-slate absolute inset-y-0 right-[2.25%] w-px" />
            <div className="bg-slate absolute inset-x-0 top-[3.5%] h-px" />
            <div className="bg-slate absolute inset-x-0 bottom-[3.5%] h-px" />
        </div>
    );
}
