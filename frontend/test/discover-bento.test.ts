import assert from "node:assert/strict";
import test from "node:test";
import { Children, isValidElement, type ReactNode } from "react";
import { DiscoverFeed } from "../src/components/features/discover/DiscoverContent";

type Props = { children?: ReactNode; [key: string]: unknown };

function nodes(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(nodes)];
}

function textContent(node: ReactNode): string {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(textContent).join("");
    return isValidElement<Props>(node) ? textContent(node.props.children) : "";
}

test("refined Discover tiles retain complete destination identity, sample-count disclosure and navigation", () => {
    const feed = nodes(DiscoverFeed());
    const indonesia = feed.find((node) => node.props["aria-label"] === "Explore Indonesia");
    assert.ok(indonesia);
    assert.equal(indonesia.props.href, "/discover/destinations/indonesia");
    assert.equal(nodes(indonesia.props.children).find((node) => node.type === "h3")?.props.children, "Indonesia");
    assert.match(textContent(indonesia.props.children), /68 boards \(sample count\)/);
    assert.equal(nodes(indonesia.props.children).filter((node) => typeof node.props.href === "string").length, 0);
});

test("By the Water keeps its accessible collection title, full supporting copy and photographic cover", () => {
    const feed = nodes(DiscoverFeed());
    const water = feed.find((node) => node.props.href === "/discover/collections/by-the-water");
    assert.ok(water);
    const children = nodes(water.props.children);
    const heading = children.find((node) => node.type === "h3");
    assert.equal(heading?.props["aria-label"], "By the Water");
    assert.equal(textContent(heading?.props.children), "BY THEWATER");
    assert.match(textContent(water.props.children), /Sea air, slow walks, and places to sit for a while\./);
    const photo = children.find((node) => typeof node.props.photo === "object");
    assert.ok(photo, "The photographic cover remains inside the collection link");
    assert.equal(photo.props.position, "center");
});
