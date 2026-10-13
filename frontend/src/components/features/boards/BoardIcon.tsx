type Props = {
    name: "bookmark" | "copy" | "close" | "arrow" | "leaf" | "heart" | "gem";
    className?: string;
};

const paths = {
    bookmark: "M6 3h12v18l-6-4-6 4V3Z",
    copy: "M9 9h12v12H9V9ZM3 15V3h12",
    close: "m6 6 12 12M6 18 18 6",
    arrow: "M19 12H5m7-7-7 7 7 7",
    leaf: "M20 4c-1 12-6 17-12 13C2 13 7 4 20 4ZM4 21 16 9",
    heart: "M12 20 3 11C-2 5 6 0 12 7c6-7 14-2 9 4l-9 9Z",
    gem: "m3 8 4-5h10l4 5-9 13L3 8Zm0 0h18M7 3l5 18 5-18"
};

export default function BoardIcon({ name, className = "size-5" }: Props) {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d={paths[name]} />
        </svg>
    );
}
