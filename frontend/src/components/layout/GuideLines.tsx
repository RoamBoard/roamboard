export default function GuideLines() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-y-0 left-[2.25%] w-px bg-slate" />
      <div className="absolute inset-y-0 right-[2.25%] w-px bg-slate" />
      <div className="absolute inset-x-0 top-[3.5%] h-px bg-slate" />
      <div className="absolute inset-x-0 bottom-[3.5%] h-px bg-slate" />
    </div>
  );
}
