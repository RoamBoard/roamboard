// Repeated masonry details only. Each building's silhouette is drawn individually.
export const windows = (xs: readonly number[], y: number, width = 7, height = 12) =>
    xs.map((x) => `M${x} ${y}h${width}v${height}h-${width}Z`).join(" ");
export const arches = (xs: readonly number[], y: number, width = 9, height = 16) =>
    xs.map((x) => `M${x} ${y + height}V${y + width / 2}q${width / 2} -${width} ${width} 0V${y + height}`).join(" ");
