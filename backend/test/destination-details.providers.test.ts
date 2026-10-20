import assert from "node:assert/strict";
import test from "node:test";
import { createWikivoyageDetails } from "../src/features/destinations/destination.details.js";
import type { GuidePlace } from "../src/features/destinations/destination.types.js";

test("country city details read Cities prose and marker-linked Commons photos with credits", async (t) => {
    const urls: URL[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        urls.push(url);
        return Response.json({
            query: {
                pages: [
                    url.hostname === "commons.wikimedia.org"
                        ? commons()
                        : {
                              pageid: 42,
                              title: "Japan",
                              extract:
                                  "== Cities ==\n1 Tokyo — The capital has historic temples and busy railway stations.\n2 Kyoto — A former capital with many gardens.\n== See ==\n1 Tokyo, Wrong sight description.",
                              mapdata: [
                                  JSON.stringify({
                                      city: [
                                          {
                                              properties: {
                                                  title: '<a href="/wiki/Tokyo">Tokyo</a>',
                                                  description: '<a href="/wiki/File:Nakasu_river.jpg">Photo</a>'
                                              }
                                          }
                                      ],
                                      see: []
                                  })
                              ]
                          }
                ]
            }
        });
    });
    const provider = createWikivoyageDetails(async () => {});
    const result = await Reflect.apply(provider.placeDetails, provider, [
        { ...sight, id: "wikivoyage:42:tokyo", name: "Tokyo" },
        undefined,
        "country"
    ]);
    assert.equal(result.description, "The capital has historic temples and busy railway stations.");
    assert.equal(result.sourceUrl, "https://en.wikivoyage.org/?curid=42#Cities");
    assert.equal(result.image?.author, "River & Street Photographer");
    assert.equal(result.image?.licenseName, "CC BY-SA 4.0");
    assert.equal(urls[0]?.searchParams.get("mpdgroups"), "see|city");
    assert.equal(urls[1]?.searchParams.get("titles"), "File:Nakasu_river.jpg");
});

test("country city details parse local names and hyphen separators outside Japan", async (t) => {
    t.mock.method(globalThis, "fetch", async () =>
        Response.json({
            query: {
                pages: [
                    {
                        pageid: 55,
                        title: "Germany",
                        extract:
                            "== Cities ==\n1 Munich (München) - A southern city with museums and public gardens.\n== See ==\nElsewhere.",
                        mapdata: [JSON.stringify({ city: [{ properties: { title: "Munich" } }] })]
                    }
                ]
            }
        })
    );
    const provider = createWikivoyageDetails(async () => {});
    const result = await Reflect.apply(provider.placeDetails, provider, [
        { ...sight, id: "wikivoyage:55:munich", name: "Munich" },
        undefined,
        "country"
    ]);
    assert.equal(result.description, "A southern city with museums and public gardens.");
    assert.equal(result.sourceUrl, "https://en.wikivoyage.org/?curid=55#Cities");
});

test("a country city without listing content follows its Wikivoyage article for intro and credited page photo", async (t) => {
    const urls: URL[] = [];
    const reserved = { count: 0 };
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        urls.push(url);
        if (url.hostname === "commons.wikimedia.org") return Response.json({ query: { pages: [commons()] } });
        if (url.searchParams.get("titles")) {
            assert.equal(url.searchParams.get("titles"), "Munich");
            assert.equal(url.searchParams.get("exintro"), "1");
            return Response.json({
                query: {
                    pages: [
                        {
                            pageid: 77,
                            title: "Munich",
                            extract: "Munich has museums and parks beside the river.",
                            pageimage: "Nakasu_river.jpg"
                        }
                    ]
                }
            });
        }
        return Response.json({
            query: {
                pages: [
                    {
                        pageid: 55,
                        title: "Germany",
                        extract: "== Cities ==\n",
                        mapdata: [
                            JSON.stringify({ city: [{ properties: { title: '<a href="/wiki/Munich">Munich</a>' } }] })
                        ]
                    }
                ]
            }
        });
    });
    const provider = createWikivoyageDetails(async () => {
        reserved.count += 1;
    });
    const result = await Reflect.apply(provider.placeDetails, provider, [
        { ...sight, id: "wikivoyage:55:munich", name: "Munich" },
        undefined,
        "country"
    ]);
    assert.equal(result.description, "Munich has museums and parks beside the river.");
    assert.equal(result.sourceUrl, "https://en.wikivoyage.org/?curid=77");
    assert.equal(result.image?.author, "River & Street Photographer");
    assert.deepEqual(result.unavailable, []);
    assert.equal(urls.length, 3);
    assert.equal(reserved.count, 2);
});

test("a Photo-only city marker still reads the linked city introduction after loading its photo", async (t) => {
    const introductions = { count: 0 };
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.hostname === "commons.wikimedia.org") return Response.json({ query: { pages: [commons()] } });
        if (url.searchParams.get("titles") === "Munich") {
            introductions.count += 1;
            return Response.json({
                query: {
                    pages: [{ pageid: 77, title: "Munich", extract: "Munich has museums and parks beside the river." }]
                }
            });
        }
        return Response.json({
            query: {
                pages: [
                    {
                        pageid: 55,
                        title: "Germany",
                        extract: "== Cities ==\n",
                        mapdata: [
                            JSON.stringify({
                                city: [
                                    {
                                        properties: {
                                            title: '<a href="/wiki/Munich">Munich</a>',
                                            description: '<a href="/wiki/File:Nakasu_river.jpg">Photo</a>'
                                        }
                                    }
                                ]
                            })
                        ]
                    }
                ]
            }
        });
    });
    const result = await createWikivoyageDetails(async () => {}).placeDetails(
        { ...sight, id: "wikivoyage:55:munich", name: "Munich" },
        undefined,
        "country"
    );
    assert.equal(result.description, "Munich has museums and parks beside the river.");
    assert.equal(result.sourceUrl, "https://en.wikivoyage.org/?curid=77");
    assert.equal(result.image?.author, "River & Street Photographer");
    assert.equal(introductions.count, 1);
});

test("city marker prose keeps its wording while omitting the image link label", async (t) => {
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.hostname === "commons.wikimedia.org") return Response.json({ query: { pages: [commons()] } });
        assert.equal(url.searchParams.has("titles"), false, "Usable marker prose does not need an intro fallback");
        return Response.json({
            query: {
                pages: [
                    {
                        pageid: 55,
                        title: "Germany",
                        extract: "== Cities ==\n",
                        mapdata: [
                            JSON.stringify({
                                city: [
                                    {
                                        properties: {
                                            title: '<a href="/wiki/Munich">Munich</a>',
                                            description:
                                                'Museums and public gardens beside the river. <a href="/wiki/File:Nakasu_river.jpg">Photo</a>'
                                        }
                                    }
                                ]
                            })
                        ]
                    }
                ]
            }
        });
    });
    const result = await createWikivoyageDetails(async () => {}).placeDetails(
        { ...sight, id: "wikivoyage:55:munich", name: "Munich" },
        undefined,
        "country"
    );
    assert.equal(result.description, "Museums and public gardens beside the river.");
    assert.equal(result.sourceUrl, "https://en.wikivoyage.org/?curid=55#Cities");
    assert.equal(result.image?.author, "River & Street Photographer");
});

test("unsafe country city links cannot trigger external reads and uncredited photos remain placeholders", async (t) => {
    const urls: URL[] = [];
    const state = { photo: commons({ extmetadata: {} }) };
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        urls.push(url);
        if (url.hostname === "commons.wikimedia.org") return Response.json({ query: { pages: [state.photo] } });
        return Response.json({
            query: {
                pages: [
                    {
                        pageid: 55,
                        title: "Germany",
                        extract: "== Cities ==\n1 Munich – A city with museums and public gardens.",
                        mapdata: [
                            JSON.stringify({
                                city: [
                                    {
                                        properties: {
                                            title: '<a href="https://evil.example/wiki/Munich">Munich</a>',
                                            description: '<a href="/wiki/File:Nakasu_river.jpg">Photo</a>'
                                        }
                                    }
                                ]
                            })
                        ]
                    }
                ]
            }
        });
    });
    const provider = createWikivoyageDetails(async () => {});
    const result = await Reflect.apply(provider.placeDetails, provider, [
        { ...sight, id: "wikivoyage:55:munich", name: "Munich" },
        undefined,
        "country"
    ]);
    assert.equal(result.description, "A city with museums and public gardens.");
    assert.equal(result.image, null);
    assert.deepEqual(result.unavailable, []);
    assert.ok(urls.every((url) => ["en.wikivoyage.org", "commons.wikimedia.org"].includes(url.hostname)));
    assert.equal(
        urls.some((url) => url.searchParams.has("titles") && url.hostname !== "commons.wikimedia.org"),
        false
    );
    state.photo = commons({ thumburl: "https://evil.example/Tokyo.jpg" });
    const unsafePhotoProvider = createWikivoyageDetails(async () => {});
    const unsafePhoto = await Reflect.apply(unsafePhotoProvider.placeDetails, unsafePhotoProvider, [
        { ...sight, id: "wikivoyage:55:munich", name: "Munich" },
        undefined,
        "country"
    ]);
    assert.equal(unsafePhoto.image, null);
    assert.deepEqual(unsafePhoto.unavailable, []);
});

test("a country city intro fallback leaves the full city article available for transport tips", async (t) => {
    const fullReads = { count: 0 };
    const munich = { name: "Munich", country: "Germany", countryCode: "DEU", latitude: 48.1372, longitude: 11.5755 };
    const cityPage = { pageid: 77, title: "Munich", coordinates: [{ lat: 48.1372, lon: 11.5755, primary: true }] };
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.searchParams.get("titles") === "Munich")
            return Response.json({
                query: { pages: [{ ...cityPage, extract: "Munich has museums and parks beside the river." }] }
            });
        if (url.searchParams.get("generator") === "search") return Response.json({ query: { pages: [cityPage] } });
        if (url.searchParams.get("pageids") === "77") {
            fullReads.count += 1;
            assert.equal(url.searchParams.has("exintro"), false);
            return Response.json({
                query: {
                    pages: [
                        {
                            ...cityPage,
                            extract:
                                "Munich has museums.\n== Get around ==\nTake the underground railway between the main station and city parks.\n== See ==\nMuseum district."
                        }
                    ]
                }
            });
        }
        return Response.json({
            query: {
                pages: [
                    {
                        pageid: 55,
                        title: "Germany",
                        extract: "== Cities ==\n",
                        mapdata: [
                            JSON.stringify({ city: [{ properties: { title: '<a href="/wiki/Munich">Munich</a>' } }] })
                        ]
                    }
                ]
            }
        });
    });
    const provider = createWikivoyageDetails(async () => {});
    const details = await provider.placeDetails(
        { ...sight, id: "wikivoyage:55:munich", name: "Munich" },
        undefined,
        "country"
    );
    assert.equal(details.description, "Munich has museums and parks beside the river.");
    const tip = await provider.cityTip(munich);
    assert.equal(tip?.text, "Take the underground railway between the main station and city parks.");
    assert.equal(tip?.url, "https://en.wikivoyage.org/?curid=77#Get_around");
    assert.equal(fullReads.count, 1);
});

test("a linked city article failure preserves whichever listing content already loaded", async (t) => {
    const state = { listingHasPhoto: false };
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.hostname === "commons.wikimedia.org") return Response.json({ query: { pages: [commons()] } });
        if (url.searchParams.get("titles") === "Tokyo") return new Response("Unavailable", { status: 503 });
        return Response.json({
            query: {
                pages: [
                    {
                        pageid: 42,
                        title: "Japan",
                        extract: state.listingHasPhoto
                            ? "== Cities ==\n"
                            : "== Cities ==\n1 Tokyo - The capital has temples and busy railway stations.",
                        mapdata: [
                            JSON.stringify({
                                city: [
                                    {
                                        properties: {
                                            title: '<a href="/wiki/Tokyo">Tokyo</a>',
                                            description: state.listingHasPhoto
                                                ? '<a href="/wiki/File:Nakasu_river.jpg"><img src="/thumb.jpg"></a>'
                                                : ""
                                        }
                                    }
                                ]
                            })
                        ]
                    }
                ]
            }
        });
    });
    const selected = { ...sight, id: "wikivoyage:42:tokyo", name: "Tokyo" };
    const text = await createWikivoyageDetails(async () => {}).placeDetails(selected, undefined, "country");
    assert.equal(text.description, "The capital has temples and busy railway stations.");
    assert.equal(text.sourceUrl, "https://en.wikivoyage.org/?curid=42#Cities");
    assert.equal(text.image, null);
    assert.deepEqual(text.unavailable, ["image"]);
    state.listingHasPhoto = true;
    const photo = await createWikivoyageDetails(async () => {}).placeDetails(selected, undefined, "country");
    assert.equal(photo.description, null);
    assert.equal(photo.image?.author, "River & Street Photographer");
    assert.deepEqual(photo.unavailable, ["description"]);
});

test("country city photo failures preserve listing prose and an explicit retry can recover the photo", async (t) => {
    const attempts = { photo: 0 };
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.hostname === "commons.wikimedia.org") {
            attempts.photo += 1;
            return attempts.photo === 1
                ? new Response("Unavailable", { status: 503 })
                : Response.json({ query: { pages: [commons()] } });
        }
        return Response.json({
            query: {
                pages: [
                    {
                        pageid: 42,
                        title: "Japan",
                        extract: "== Cities ==\n1 Tokyo — The capital has temples and busy railway stations.",
                        mapdata: [
                            JSON.stringify({
                                city: [
                                    {
                                        properties: {
                                            title: "Tokyo",
                                            description: '<a href="/wiki/File:Nakasu_river.jpg">Photo</a>'
                                        }
                                    }
                                ]
                            })
                        ]
                    }
                ]
            }
        });
    });
    const provider = createWikivoyageDetails(async () => {});
    const selected = { ...sight, id: "wikivoyage:42:tokyo", name: "Tokyo" };
    const first = await Reflect.apply(provider.placeDetails, provider, [selected, undefined, "country"]);
    assert.equal(first.description, "The capital has temples and busy railway stations.");
    assert.equal(first.image, null);
    assert.deepEqual(first.unavailable, ["image"]);
    const retry = await Reflect.apply(provider.placeDetails, provider, [selected, undefined, "country"]);
    assert.equal(retry.image?.author, "River & Street Photographer");
    assert.deepEqual(retry.unavailable, []);
    assert.equal(attempts.photo, 2);
});

const city = { name: "Fukuoka", country: "Japan", countryCode: "JPN", latitude: 33.5902, longitude: 130.4017 };
const sight: GuidePlace = {
    provider: "wikivoyage",
    id: "wikivoyage:12208:nakasu",
    name: "Nakasu",
    address: "Fukuoka, Japan",
    latitude: 33.591,
    longitude: 130.407
};

// These fixtures use MediaWiki's plain extracts and rendered map listing references.
function page(extract: string, withImage = true) {
    return {
        pageid: 12208,
        title: "Fukuoka",
        coordinates: [{ lat: city.latitude, lon: city.longitude, primary: true, globe: "earth" }],
        extract,
        mapdata: [
            JSON.stringify({
                see: [
                    {
                        properties: {
                            title: '<a href="/wiki/Fukuoka#Nakasu">Nakasu</a>',
                            description: withImage
                                ? '<a href="/wiki/File:Nakasu_river.jpg"><img src="/thumb.jpg"></a>'
                                : ""
                        }
                    }
                ]
            })
        ]
    };
}

function commons(overrides = {}) {
    return {
        pageid: 90,
        imageinfo: [
            {
                mime: "image/jpeg",
                width: 3000,
                height: 2000,
                url: "https://upload.wikimedia.org/wikipedia/commons/n/n1/Nakasu_river.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Nakasu_river.jpg",
                thumburl:
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/n/n1/Nakasu_river.jpg/1200px-Nakasu_river.jpg",
                thumbwidth: 1200,
                thumbheight: 800,
                extmetadata: {
                    Artist: { value: '<a href="/wiki/User:Photographer">River &amp; Street Photographer</a>' },
                    LicenseShortName: { value: "CC BY-SA 4.0" },
                    LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" }
                },
                ...overrides
            }
        ]
    };
}

test("transport tips come from Get around prose, retain attribution and stop before the next city-guide section", async (t) => {
    const urls: URL[] = [];
    const source = page(
        [
            "Fukuoka is a city in Japan.",
            "== Get in ==",
            "Airport arrival information belongs to another section.",
            "== Get around ==",
            "=== By subway ===",
            "Take the subway between Hakata Station and the city centre. Trains run across several useful city routes. A third sentence must be omitted.",
            "== See ==",
            "1 Nakasu, Riverside streets with food stalls."
        ].join("\n")
    );
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        urls.push(new URL(String(input)));
        return Response.json({ query: { pages: [source] } });
    });
    const provider = createWikivoyageDetails(async () => {});
    const tip = await provider.cityTip(city);
    assert.equal(tip?.title, "Getting around");
    assert.equal(
        tip?.text,
        "Take the subway between Hakata Station and the city centre. Trains run across several useful city routes."
    );
    assert.equal(tip?.url, "https://en.wikivoyage.org/?curid=12208#Get_around");
    assert.equal(urls[0]?.origin, "https://en.wikivoyage.org");
    assert.equal(urls[0]?.searchParams.get("explaintext"), "1");
    assert.equal(urls[0]?.searchParams.get("exsectionformat"), "wiki");
});

test("same-name distant cities and missing transport sections provide no invented tip", async (t) => {
    const state = { pages: [page("== Get around ==\nUse the subway between the station and the city centre.")] };
    state.pages[0]!.coordinates = [{ lat: 48.8566, lon: 2.3522, primary: true, globe: "earth" }];
    t.mock.method(globalThis, "fetch", async () => Response.json({ query: { pages: state.pages } }));
    const provider = createWikivoyageDetails(async () => {});
    assert.equal(await provider.cityTip(city), null);
    state.pages = [page("== See ==\n1 Nakasu, A riverside district with street food.")];
    assert.equal(await provider.cityTip(city), null);
});

test("country transport tips accept the country article beyond the city distance limit", async (t) => {
    const source = {
        ...page("== Get around ==\nTake trains between the major cities all across Japan."),
        title: "Japan",
        coordinates: [{ lat: 35, lon: 136, primary: true, globe: "earth" }]
    };
    t.mock.method(globalThis, "fetch", async () => Response.json({ query: { pages: [source] } }));
    const provider = createWikivoyageDetails(async () => {});
    const tip = await provider.cityTip({
        name: "Japan",
        country: "Japan",
        countryCode: "JPN",
        latitude: 36.5,
        longitude: 139,
        kind: "country"
    });
    assert.equal(tip?.text, "Take trains between the major cities all across Japan.");
});

test("a coordinate search is followed by one matched-page extract shared with selected-sight details", async (t) => {
    const urls: URL[] = [];
    const reservations = { count: 0 };
    const source = page(
        "== Get around ==\nTake the subway between Hakata Station and the city centre.\n== See ==\n1 Nakasu, Riverside streets with food stalls.",
        false
    );
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        urls.push(url);
        if (url.searchParams.get("generator") === "search") {
            return Response.json({
                query: {
                    pages: [
                        { pageid: 42, title: "Fukuoka", coordinates: [{ lat: 48.8566, lon: 2.3522, primary: true }] },
                        { pageid: source.pageid, title: source.title, coordinates: source.coordinates }
                    ]
                }
            });
        }
        assert.equal(url.searchParams.get("pageids"), "12208");
        assert.equal(url.searchParams.get("explaintext"), "1");
        assert.equal(url.searchParams.get("exlimit"), "1");
        return Response.json({ query: { pages: [source] } });
    });
    const provider = createWikivoyageDetails(async () => {
        reservations.count += 1;
    });
    const tip = await provider.cityTip(city);
    assert.equal(tip?.text, "Take the subway between Hakata Station and the city centre.");
    assert.equal(tip?.url, "https://en.wikivoyage.org/?curid=12208#Get_around");
    assert.equal(urls.length, 2);
    assert.equal(reservations.count, 1);
    const selected = await provider.placeDetails(sight);
    assert.equal(selected.description, "Riverside streets with food stalls.");
    assert.equal(urls.length, 2, "The full city extract should be reused when its sight is selected");
    assert.equal(reservations.count, 1);
});

test("a sight gets its own numbered listing description rather than a longer similarly named listing", async (t) => {
    t.mock.method(globalThis, "fetch", async () =>
        Response.json({
            query: {
                pages: [
                    page(
                        [
                            "== See ==",
                            "1 Nakasu Shrine, A separate shrine away from the riverside district.",
                            "2 Nakasu, Walk beside the river and visit the food stalls. The district has several bridges. A third sentence is not needed.",
                            "3 Ohori Park, Lakeside paths and gardens."
                        ].join("\n"),
                        false
                    )
                ]
            }
        })
    );
    const result = await createWikivoyageDetails(async () => {}).placeDetails(sight);
    assert.equal(result.placeId, sight.id);
    assert.equal(
        result.description,
        "Walk beside the river and visit the food stalls. The district has several bridges."
    );
    assert.equal(result.sourceUrl, "https://en.wikivoyage.org/?curid=12208#Nakasu");
    assert.equal(result.image, null);
    assert.deepEqual(result.unavailable, []);
});

test("listing-linked Commons photographs retain high resolution and plain photographer and license credits", async (t) => {
    const reservations = { count: 0 };
    const statuses: number[] = [];
    const urls: URL[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        urls.push(url);
        return Response.json({
            query: {
                pages: [
                    url.hostname === "commons.wikimedia.org"
                        ? commons()
                        : page("== See ==\n1 Nakasu, Riverside streets and food stalls.")
                ]
            }
        });
    });
    const provider = createWikivoyageDetails(async () => {
        reservations.count += 1;
    });
    const result = await provider.placeDetails(sight, async ({ status }) => {
        statuses.push(status);
    });
    assert.ok(result.image);
    assert.equal(result.image.width, 1200);
    assert.equal(result.image.height, 800);
    assert.equal(result.image.alt, "Nakasu");
    assert.equal(result.image.author, "River & Street Photographer");
    assert.equal(result.image.sourceUrl, "https://commons.wikimedia.org/wiki/File:Nakasu_river.jpg");
    assert.equal(result.image.licenseName, "CC BY-SA 4.0");
    assert.equal(result.image.licenseUrl, "https://creativecommons.org/licenses/by-sa/4.0/");
    assert.doesNotMatch(JSON.stringify(result.image), /<a|<img|href=/);
    assert.equal(urls[1]?.searchParams.get("titles"), "File:Nakasu_river.jpg");
    assert.equal(urls[1]?.searchParams.get("iiurlwidth"), "1200");
    assert.equal(reservations.count, 1);
    assert.deepEqual(statuses, [200, 200]);
});

test("Commons CC0 photos normalize official legacy HTTP license links to HTTPS", async (t) => {
    const legacyPhoto = commons({
        extmetadata: {
            Artist: { value: "Jmho" },
            LicenseShortName: { value: "CC0" },
            LicenseUrl: { value: "http://creativecommons.org/publicdomain/zero/1.0/deed.en" }
        }
    });
    t.mock.method(globalThis, "fetch", async (input: string | URL) =>
        Response.json({
            query: {
                pages: [
                    new URL(String(input)).hostname === "commons.wikimedia.org"
                        ? legacyPhoto
                        : page("== See ==\n1 Nakasu, Riverside streets and food stalls.")
                ]
            }
        })
    );
    const result = await createWikivoyageDetails(async () => {}).placeDetails(sight);
    assert.ok(result.image);
    assert.equal(result.image.author, "Jmho");
    assert.equal(result.image.licenseName, "CC0");
    assert.equal(result.image.licenseUrl, "https://creativecommons.org/publicdomain/zero/1.0/deed.en");
    assert.equal(
        result.image.url,
        "https://upload.wikimedia.org/wikipedia/commons/thumb/n/n1/Nakasu_river.jpg/1200px-Nakasu_river.jpg"
    );
});

test("HTTP license links outside official Creative Commons hosts remain placeholders", async (t) => {
    const state = { license: "http://licenses.example/CC0" };
    t.mock.method(globalThis, "fetch", async (input: string | URL) =>
        Response.json({
            query: {
                pages: [
                    new URL(String(input)).hostname === "commons.wikimedia.org"
                        ? commons({
                              extmetadata: {
                                  Artist: { value: "Jmho" },
                                  LicenseShortName: { value: "CC0" },
                                  LicenseUrl: { value: state.license }
                              }
                          })
                        : page("== See ==\n1 Nakasu, Riverside streets and food stalls.")
                ]
            }
        })
    );
    for (const license of ["http://licenses.example/CC0", "http://creativecommons.org.evil.example/CC0"]) {
        state.license = license;
        const result = await createWikivoyageDetails(async () => {}).placeDetails(sight);
        assert.equal(result.image, null);
        assert.deepEqual(result.unavailable, []);
    }
});

test("missing listing references, low-resolution photos and missing credits remain named-placeholder data", async (t) => {
    const state = {
        photo: commons(),
        source: page("== See ==\n1 Nakasu, Riverside streets and food stalls.", false),
        calls: 0
    };
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        state.calls += 1;
        return Response.json({
            query: { pages: [new URL(String(input)).hostname === "commons.wikimedia.org" ? state.photo : state.source] }
        });
    });
    const missing = await createWikivoyageDetails(async () => {}).placeDetails(sight);
    assert.equal(missing.image, null);
    assert.deepEqual(missing.unavailable, []);
    assert.equal(state.calls, 1);
    state.source = page("== See ==\n1 Nakasu, Riverside streets and food stalls.");
    for (const photo of [commons({ width: 600, height: 400 }), commons({ extmetadata: {} })]) {
        state.photo = photo;
        const result = await createWikivoyageDetails(async () => {}).placeDetails(sight);
        assert.equal(result.image, null);
        assert.deepEqual(result.unavailable, []);
    }
});

test("malformed sight map metadata preserves the readable listing description", async (t) => {
    const source = page("== See ==\n1 Nakasu, Riverside streets and food stalls.");
    source.mapdata = ["{not-json"];
    t.mock.method(globalThis, "fetch", async () => Response.json({ query: { pages: [source] } }));
    const result = await createWikivoyageDetails(async () => {}).placeDetails(sight);
    assert.equal(result.description, "Riverside streets and food stalls.");
    assert.equal(result.image, null);
    assert.deepEqual(result.unavailable, ["image"]);
});

test("a Commons failure preserves sight prose and a later explicit call can retry the photo", async (t) => {
    const state = { commonsCalls: 0 };
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        if (new URL(String(input)).hostname !== "commons.wikimedia.org")
            return Response.json({
                query: { pages: [page("== See ==\n1 Nakasu, Riverside streets and food stalls.")] }
            });
        state.commonsCalls += 1;
        return state.commonsCalls === 1
            ? new Response("Provider failed", { status: 503 })
            : Response.json({ query: { pages: [commons()] } });
    });
    const provider = createWikivoyageDetails(async () => {});
    const first = await provider.placeDetails(sight);
    assert.equal(first.description, "Riverside streets and food stalls.");
    assert.equal(first.image, null);
    assert.deepEqual(first.unavailable, ["image"]);
    const retried = await provider.placeDetails(sight);
    assert.ok(retried.image);
    assert.deepEqual(retried.unavailable, []);
    assert.equal(state.commonsCalls, 2);
});
