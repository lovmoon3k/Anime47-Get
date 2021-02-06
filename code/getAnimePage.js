import axios from "axios";
import fs from "fs";
import slugify from "slugify";
import { v4 as uuid } from "uuid";

import logger, { LogGreen, LogCyan } from "../config/logger.js";
import "../config/loadEnv.js";
import {} from "../test/unitTest.js";

import { getServerFromBtn, getEpisodeId, getSourceVideo } from "./getVideo.js";

function GetEpisodePage(episodeUrl, episode, episodeId, movieName, directory) {
  return new Promise(async (resolve, reject) => {
    let reTryIfFail = 0;
    let isDone = false;
    while (!isDone && reTryIfFail <= Number(process.env.RE_SEND_REQUEST)) {
      await axios({
        url: episodeUrl,
        method: "GET",
        headers: {
          Cookie: process.env.Cookie,
        },
      })
        .then(async (res) => {
          const servers = getServerFromBtn(res.data);
          if (servers.length === 0) {
            logger.error(
              `Cannot get Servers of Episode: ${episode}, url episode: ${episodeUrl}, episodeId: ${episodeId} , Anime name: ${movieName}`
            );
            return resolve(false);
          }

          let isSaved = false;
          for (const server of servers) {
            LogCyan(
              `---- Start Getting Video, Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId}, Server: ${server.name} ---- `
            );
            const videoName = await getSourceVideo(
              episodeId,
              server.id,
              movieName,
              episode,
              directory
            );
            if (!videoName) {
              logger.error(
                `---- Cannot get current video server, start another server, Current Server: ${server.name}, Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId} ----`
              );
            } else {
              isSaved = true;
            }
          }

          if (isSaved) {
            isDone = true;
            return resolve(true);
          } else {
            logger.error(
              `Can't save any video of episode url: ${episodeUrl} ,episode: ${episode}, episodeId: ${episodeId} ,Anime name: ${movieName}`
            );
            logger.warn(`Anime Specific Episodes: episode url: ${episodeUrl}`);
            isDone = true;
            return resolve(false);
          }
        })
        .catch((err) => {
          logger.error(
            `Error while get episode url: ${episodeUrl} , Retry count: ${reTryIfFail}, episode: ${episode}, episodeId: ${episodeId} , Anime name: ${movieName}`
          );
          logger.error(err.response ? err.response.data : err);
          logger.warn(`Anime Specific Episodes: episode url: ${episodeUrl}`+ ', Retry Count: ' + reTryIfFail);
          reTryIfFail++;
          return resolve(false);
        });
    }
  });
}

async function GetAllEpisodes(contentLink, animeDetail) {
  function getEpisodeUrl(aTag) {
    const regex = /href="(.*?)"/;
    const str = aTag;
    let m;
    let result = null;
    if ((m = regex.exec(str)) !== null) {
      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        if (groupIndex === 0) return;
        result = encodeURI(match);
      });
    }
    return result;
  }

  function getEpisodeName(aTag) {
    const regex = /data-episode-name="(.*?)"/;
    const str = aTag;
    let m;
    let result = null;
    if ((m = regex.exec(str)) !== null) {
      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        if (groupIndex === 0) return;
        result = match;
      });
    }
    return result;
  }

  function getEpisodeId(aTag) {
    const regex = /data-episode-id="(.*?)"/;
    const str = aTag;
    let m;
    let result = null;
    if ((m = regex.exec(str)) !== null) {
      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        if (groupIndex === 0) return;
        result = match;
      });
    }
    return result;
  }

  function writeAnimeDetailToFile(directory) {
    fs.appendFile(
      directory + "/anime_detail.json",
      JSON.stringify(animeDetail, null, 4),
      function (err) {
        if (err) {
          logger.error(
            `---- Error in write anime detail to file, Movie name: ${animeDetail.shortName}, URL: ${animeDetail.watchAnimeUrl} ---- `
          );
          logger.error(err);
          return false;
        }
        LogGreen(
          `----  Write anime detail to file success, Movie name: ${animeDetail.shortName}, URL: ${animeDetail.watchAnimeUrl} ----  `
        );
        return true;
      }
    );
  }

  const allEpisodes = [];
  const regex = /<a(.*?)>.*?<\/a>/gs;
  const str = contentLink;
  let m;

  while ((m = regex.exec(str)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    // The result can be accessed through the `m`-variable.
    m.forEach((match, groupIndex) => {
      if (groupIndex === 0) return;
      allEpisodes.push({
        id: getEpisodeId(match),
        url: getEpisodeUrl(match),
        name: getEpisodeName(match),
      });
    });
  }

  if (allEpisodes.length <= 0) {
    logger.error("Episodes list smaller then 0 when filter, anime detail:");
    logger.error(animeDetail);
    logger.warn("Anime Get All Episodes: " + animeDetail.watchAnimeUrl);
    return;
  }

  let directory =
    "./videos/" + slugify(animeDetail.shortName, { strict: true });
  let isCreated = false;
  LogCyan(
    `------ Starting create directory for anime directory: ${directory}, Anime: ${animeDetail.shortName}`
  );
  while (!isCreated) {
    try {
      if (!fs.existsSync(directory)) fs.mkdirSync(directory);

      isCreated = true;
    } catch (e) {
      LogCyan(
        `------ Create directory for anime failed, directory: ${directory}, Anime: ${animeDetail.shortName}`
      );
      directory = "./videos/" + uuid();
      LogCyan(
        `------ Create directory with custom UUID, new directory name: ${directory}, Anime: ${animeDetail.shortName}`
      );
    }
  }
  LogGreen(
    `------ Create directory for anime success, directory: ${directory}, Anime: ${animeDetail.shortName}`
  );

  // Write detail Anime to file
  writeAnimeDetailToFile(directory);

  LogCyan(`------ Start Getting All Episodes, Anime: ${animeDetail.shortName}`);

  for (const episode of allEpisodes) {
    GetEpisodePage(
      episode.url,
      episode.name,
      episode.id,
      animeDetail.shortName,
      directory
    );
    LogCyan(
      `------ Waiting 3 seconds before getting new episodes, Anime: ${animeDetail.shortName}, Current Episodes: ${episode.name}`
    );
    await sleep(3000);
  }
}

async function GetFirstWatchAnime(animeDetail) {
  function GetServerMostLink(response) {
    function getMostLinkFromList(ulStringElement) {
      const newUlStringElement = ulStringElement.map((ul) => {
        const regex = /<li>(.*?)<\/li>/g;
        const str = ul;
        let m;
        let count = 0;
        while ((m = regex.exec(str)) !== null) {
          // This is necessary to avoid infinite loops with zero-width matches
          if (m.index === regex.lastIndex) {
            regex.lastIndex++;
          }

          // The result can be accessed through the `m`-variable.
          m.forEach((match, groupIndex) => {
            if (groupIndex === 0) return;
            count++;
          });
        }
        return {
          content: ul,
          totalEpisodes: count,
        };
      });
      const serverHaveMaxEpisodes = newUlStringElement.reduce(function (a, b) {
        return a.totalEpisodes > b.totalEpisodes ? a : b;
      });
      return serverHaveMaxEpisodes.content;
    }

    const regex = /<div class=\"episodes col-lg-12 col-md-12 col-sm-12\"><ul>(.*?)<\/ul><\/div>/g;
    const str = response;
    let m;

    const ulStringElement = [];
    while ((m = regex.exec(str)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        if (groupIndex === 0) return;
        ulStringElement.push(match);
      });
    }
    if (ulStringElement.length === 0) {
      logger.error(
        `Get ul list contains all fansub equal zero, anime: ${animeDetail.shortName}, watch anime url: ${watchAnimeUrl}`
      );
      return null;
    }
    return getMostLinkFromList(ulStringElement);
  }

  LogCyan(
    `------ Start Getting First Watch Anime, Anime Url: ${animeDetail.watchAnimeUrl}`
  );

  let reTryIfFail = 0;
  let isDone = false;

  let response = null;
  while (!isDone && reTryIfFail <= Number(process.env.RE_SEND_REQUEST)){
    response = await axios({
      url: animeDetail.watchAnimeUrl,
      method: "GET",
      headers: {
        Cookie: process.env.Cookie,
      },
    })
      .then((res) => {
        isDone = true;
        return res.data;
      })
      .catch((err) => {
        logger.error(
          "Error in get First watch anime, anime url: " +
            animeDetail.watchAnimeUrl + ', Retry Count: ' + reTryIfFail
        );
        logger.error(err.response ? err.response.data : err);
        logger.warn("Anime First Watch: " + animeDetail.watchAnimeUrl+ ', Retry Count: ' + reTryIfFail);
        reTryIfFail++;
        return null;
      });
  }

  if (!response) return;

  const serverMostLinks = GetServerMostLink(response);
  if (!serverMostLinks) return;
  GetAllEpisodes(serverMostLinks, animeDetail);
}

export async function GetDetailAnime(animeUrl) {
  function getAnimeInformation(response) {
    function getShortName() {
      const regex = /<span class=\"title-1\" itemprop=\"name\">(.*?)<\/span>/;
      const str = response;
      let m;
      let result = null;
      if ((m = regex.exec(str)) !== null) {
        // The result can be accessed through the `m`-variable.
        m.forEach((match, groupIndex) => {
          result = match;
        });
      }
      return result;
    }

    function getLongName() {
      const regex = /<span class=\"title-2\" itemprop=\"name\">(.*?)<\/span>/;
      const str = response;
      let m;
      let result = null;
      if ((m = regex.exec(str)) !== null) {
        // The result can be accessed through the `m`-variable.
        m.forEach((match, groupIndex) => {
          result = match;
        });
      }
      return result;
    }

    function getStatus() {
      const regex = /<dd class=\"movie-dd imdb\">(.*?)<\/dd>/;
      const str = response;
      let m;
      let result = null;
      if ((m = regex.exec(str)) !== null) {
        // The result can be accessed through the `m`-variable.
        m.forEach((match, groupIndex) => {
          result = match;
        });
      }
      return result;
    }

    function getYearRelease() {
      const regex = /<span class=\"title-year\"> \((\d+)\)<\/span>/;
      const str = response;
      let m;
      let result = null;
      if ((m = regex.exec(str)) !== null) {
        // The result can be accessed through the `m`-variable.
        m.forEach((match, groupIndex) => {
          result = match;
        });
      }
      return result;
    }

    function getDescription() {
      const regex = /<div class="news-article">(.*?)<\/div>/s;
      const str = response;
      let m;
      let result = null;
      if ((m = regex.exec(str)) !== null) {
        // The result can be accessed through the `m`-variable.
        m.forEach((match, groupIndex) => {
          result = match;
        });
      }
      return result;
    }

    function watchAnimeUrl() {
      const regex = /<a id=\"btn-film-watch\" class=\"btn btn-red\" .* href=\"(.*?)\">Xem Anime<\/a>/;
      const str = response;
      let m;
      let result = null;
      if ((m = regex.exec(str)) !== null) {
        // The result can be accessed through the `m`-variable.
        m.forEach((match, groupIndex) => {
          result = match;
        });
      }
      return result;
    }

    return {
      shortName: getShortName(),
      longName: getLongName(),
      yearRelease: getYearRelease(),
      status: getStatus(),
      description: getDescription(),
      watchAnimeUrl: watchAnimeUrl()
        ? watchAnimeUrl().replace("./", "https://anime47.com/")
        : null,
    };
  }

  LogCyan(`------ Start Getting Detail Anime, Anime Url: ${animeUrl}`);

  let reTryIfFail = 0;
  let isDone = false;
  let response = null;
  while (!isDone && reTryIfFail <= Number(process.env.RE_SEND_REQUEST)) {
    response = await axios({
      url: animeUrl,
      method: "GET",
      headers: {
        Cookie: process.env.Cookie,
      },
    })
      .then((res) => {
        isDone = true;
        return res.data;
      })
      .catch((err) => {
        logger.error("Error in get Detail Anime, anime url: " + animeUrl + ', Retry Count: ' + reTryIfFail);
        logger.error(err.response ? err.response.data : err);
        logger.warn("Anime Detail: " + animeUrl + ', Retry Count: ' + reTryIfFail);
        reTryIfFail++;
        return null;
      });
  }


  if (!response) return;

  const animeInformation = getAnimeInformation(response);
  if (
    animeInformation.shortName === null ||
    animeInformation.watchAnimeUrl === null ||
    animeInformation.watchAnimeUrl === null
  ) {
    logger.error(
      "Error in get Detail Anime with short name or watch anime url or watchAnimeUrl cannot get, maybe it is a trailer, anime url: " +
        animeUrl
    );
    return;
  }
  GetFirstWatchAnime(animeInformation);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, process.env.DELAY_TIME);
  });
}
