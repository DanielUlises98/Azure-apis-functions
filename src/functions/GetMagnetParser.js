const { app } = require("@azure/functions");
const cheerio = require("cheerio");

const SUKEBERI_URL = "https://sukebei.nyaa.si/?f=0&c=0_0&q=";
const JAV141_URL = "https://www.141jav.com/search/";

app.http("GetMagnetParser", {
  methods: ["GET"],
  authLevel: "function",
  handler: async (request, context) => {
    const fromSite = request.query.get("fromSite");
    const title = request.query.get("title");

    if (!fromSite) {
      return {
        status: 400,
        body: "fromSite parameter is required",
      };
    }

    if (!title) {
      return {
        status: 400,
        body: "Title parameter is required",
      };
    }

    try {
      const site = fromSite === "0" ? SUKEBERI_URL : JAV141_URL;
      const url =
        fromSite === "0"
          ? `${site}${title}`
          : `${site}${title.replace("-", "")}`;
      const magnetLinks = await ScrappMagnetLink(url);

      if (magnetLinks.length === 0) {
        return {
          status: 404,
          body: "Record not found",
        };
      }

      return {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(magnetLinks),
      };
    } catch (error) {}
  },
});

/**
 *
 * @param {string} size
 * @param {string} magnet
 * @param {string} downloads
 * @returns {createTorrentData}
 */
const createTorrentData = (size, magnet, downloads) => {
  return {
    size,
    magnet,
    downloads,
  };
};

/** Flattens the string and removes unecesary characters
 * @param {string} title
 */
function FlattenTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Brings the magnets of the code provided
 * @param {string} url
 */
async function ScrappMagnetLink(url) {
  const response = await fetch(url);
  const data = await response.text();
  const sukebeilinks = [];

  const $ = cheerio.load(data);

  if (url.includes("141jav")) {
    const elementWithTitle = $('a[title="Magnet torrent"]');
    const javMagnetlink = elementWithTitle.attr("href");

    if (!javMagnetlink) {
      return res.status(404).json({ error: "magnet not found" });
    }

    const magnetlink = javMagnetlink;

    return magnetlink;
  } else if (url.includes("sukebei")) {
    const table = $("table");

    if (table.length > 0) {
      $("table tr").each((_index, row) => {
        const sizeOfMagnet = $(row).find("td:eq(3)");
        if (sizeOfMagnet.length > 0) {
          const thirdColumnText = sizeOfMagnet.text().trim();

          const magnetLinkSukebei = $(row)
            .find('td:eq(2) a[href*="magnet"]')
            .attr("href");

          const seventhColumn = $(row).find("td:eq(7)").text().trim();

          sukebeilinks.push(
            createTorrentData(thirdColumnText, magnetLinkSukebei, seventhColumn)
          );
        }
      });
    } else {
      return {
        status: 400,
        body: "There is no table",
      };
    }
    return sukebeilinks;
  }
}
