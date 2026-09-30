import type { ReactNode } from "react";
import Link from "next/link";

export type ProfileControlProps = {
  href: string;
  label?: ReactNode;
};

export default function ProfileControl({
  href,
  label = <>My<br />Profile</>,
}: ProfileControlProps) {
  const controlClasses = "absolute left-[36%] top-[45%] text-left text-14 leading-none focus-visible:outline-1 focus-visible:outline-offset-4";

  return (
    <div className="absolute right-[1.3%] top-0 h-[8.75rem] w-[8.25rem] sm:h-[24%] sm:w-[14.5%]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="absolute left-0 right-[9%] top-[18%] h-0.5 bg-stone" />
        <span className="absolute right-[17%] top-0 h-[39%] w-0.5 bg-stone" />
        <span className="absolute bottom-0 left-[32%] top-[25%] w-0.5 bg-stone" />
        <span className="absolute left-[16%] right-0 top-[66%] h-0.5 bg-stone" />
      </div>
      <Link href={href} className={controlClasses}>{label}</Link>
    </div>
  );
}
