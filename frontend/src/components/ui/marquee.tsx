"use client";

// Adapted from Magic UI's @magicui/marquee registry component (MIT).
// See MAGICUI-LICENSE.txt. Playback-rate easing preserves the looping phase.
import { animate } from "motion/react";
import {
    useEffect,
    useRef,
    useState,
    type ComponentPropsWithoutRef
} from "react";

type MarqueeProps = ComponentPropsWithoutRef<"div"> & {
    reverse?: boolean;
    pauseOnHover?: boolean;
    vertical?: boolean;
    repeat?: number;
    paused?: boolean;
};

export function Marquee({
    className = "",
    reverse = false,
    pauseOnHover = false,
    vertical = false,
    repeat = 2,
    paused = false,
    children,
    ...props
}: MarqueeProps) {
    const container = useRef<HTMLDivElement>(null);
    const speed = useRef(1);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        const animations =
            container.current
                ?.getAnimations({ subtree: true })
                .filter(
                    (animation) =>
                        animation instanceof CSSAnimation &&
                        animation.animationName.startsWith("marquee")
                ) ?? [];
        const controls = animate(
            speed.current,
            paused || focused || hovered ? 0 : 1,
            {
                duration: focused || paused ? 0 : 0.7,
                ease: "easeOut",
                onUpdate: (value) => {
                    speed.current = value;
                    animations.forEach((animation) =>
                        animation.updatePlaybackRate(value)
                    );
                }
            }
        );
        return () => controls.stop();
    }, [paused, focused, hovered]);

    return (
        <div
            {...props}
            ref={container}
            data-marquee=""
            onMouseEnter={() => pauseOnHover && setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setFocused(false);
                }
            }}
            className={`flex gap-(--gap) overflow-hidden [--duration:40s] [--gap:1rem] ${vertical ? "flex-col" : "flex-row"} ${className}`}
        >
            {Array.from({ length: repeat }, (_, index) => (
                <div
                    key={index}
                    data-marquee-track=""
                    className={`flex shrink-0 gap-(--gap) [animation-delay:var(--delay,0s)] motion-reduce:animate-none ${vertical ? "animate-marquee-vertical flex-col" : "animate-marquee flex-row"} ${reverse ? "[animation-direction:reverse]" : ""}`}
                >
                    {children}
                </div>
            ))}
        </div>
    );
}
