import axios from "axios";
import fs from "fs";
import { v4 as uuid } from "uuid";
import CryptoJS from "crypto-js";
import atob from "atob";
import fetch from "node-fetch";
import slugify from "slugify";
import childProcess from "child_process";

import logger, { LogGreen, LogYellow } from "../config/logger.js";
import "../config/loadEnv.js";

export const getServerFromBtn = (html) => {
  const getServerIdFromString = (serverString) => {
    serverString = serverString.toLowerCase();
    return serverString.split("sv").length > 0
      ? serverString.split("sv")[1]
      : null;
  };

  const regex = /<span class=\"btn btn-green(?: active)?\" title=.*? id=\"(\w+)\".*?>(\w+)<\/span>/g;
  const str = html;
  let m;

  const servers = [];

  while ((m = regex.exec(str)) !== null) {
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    let objServerMovie = {
      id: null,
      name: "",
    };

    m.forEach((match, groupIndex) => {
      if (groupIndex === 0) return;
      if (groupIndex === 1) objServerMovie.id = getServerIdFromString(match);
      else if (groupIndex === 2) objServerMovie.name = match;
    });

    if (objServerMovie.id === null || objServerMovie.name === "") continue;

    servers.push(objServerMovie);
  }

  return servers;
};

export const getEpisodeId = (url) => {
  const regex = /anime47.com\/.+\/(\d+)/;
  const str = url;
  let m;

  let movieId = null;
  if ((m = regex.exec(str)) !== null) {
    // The result can be accessed through the `m`-variable.
    m.forEach((match, groupIndex) => {
      if (groupIndex === 0) return;
      movieId = match;
    });
  }
  return movieId;
};

function getSourcePlayerWithThanhHoaAtob(responseWithScriptTag) {
  function getThanhHoaAtob() {
    const regex = /atob\("(.*?)"\)/;
    const str = responseWithScriptTag;
    let m;
    let thanhHoaAtob = null;
    if ((m = regex.exec(str)) !== null) {
      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        if (groupIndex === 0) return;
        thanhHoaAtob = match;
      });
    }
    return thanhHoaAtob;
  }

  const DefaultParameter = [
    "\x65\x6E\x63",
    "\x63\x69\x70\x68\x65\x72\x74\x65\x78\x74",
    "\x69\x76",
    "\x73\x61\x6C\x74",
    "\x73",
    "\x73\x74\x72\x69\x6E\x67\x69\x66\x79",
    "\x70\x61\x72\x73\x65",
    "\x63\x74",
    "\x42\x61\x73\x65\x36\x34",
    "\x63\x72\x65\x61\x74\x65",
    "\x43\x69\x70\x68\x65\x72\x50\x61\x72\x61\x6D\x73",
    "\x6C\x69\x62",
    "\x48\x65\x78",
  ];
  const CryptoJSAesJson = {
    stringify: function (InputFunction) {
      var variable1 = {
        ct: InputFunction[DefaultParameter[1]].toString(
          CryptoJS[DefaultParameter[0]].Base64
        ),
      };
      if (InputFunction[DefaultParameter[2]]) {
        variable1[DefaultParameter[2]] = InputFunction[
          DefaultParameter[2]
        ].toString();
      }
      if (InputFunction[DefaultParameter[3]]) {
        variable1[DefaultParameter[4]] = InputFunction[
          DefaultParameter[3]
        ].toString();
      }
      return JSON[DefaultParameter[5]](variable1);
    },
    parse: function (_0x9c90x4) {
      var variable1 = JSON[DefaultParameter[6]](_0x9c90x4);
      var InputFunction = CryptoJS[DefaultParameter[11]][DefaultParameter[10]][
        DefaultParameter[9]
      ]({
        ciphertext: CryptoJS[DefaultParameter[0]][DefaultParameter[8]][
          DefaultParameter[6]
        ](variable1[DefaultParameter[7]]),
      });
      if (variable1[DefaultParameter[2]]) {
        InputFunction[DefaultParameter[2]] = CryptoJS[DefaultParameter[0]][
          DefaultParameter[12]
        ][DefaultParameter[6]](variable1[DefaultParameter[2]]);
      }
      if (variable1[DefaultParameter[4]]) {
        InputFunction[DefaultParameter[3]] = CryptoJS[DefaultParameter[0]][
          DefaultParameter[12]
        ][DefaultParameter[6]](variable1[DefaultParameter[4]]);
      }
      return InputFunction;
    },
  };

  try {
    const sourceEncrypt = getThanhHoaAtob(responseWithScriptTag);

    const thanhhoa = atob(sourceEncrypt);
    const daklak = JSON.parse(
      CryptoJS.AES.decrypt(thanhhoa, "caphedaklak", {
        format: CryptoJSAesJson,
      }).toString(CryptoJS.enc.Utf8)
    );
    return daklak;
  } catch {
    return null;
  }
}

function getIFrameSource(responseWithIFrameTag) {
  const regex = /<iframe.*?src="(.*?)".*>/;
  const str = responseWithIFrameTag;
  let m;
  let iframeUrl = null;

  if ((m = regex.exec(str)) !== null) {
    // The result can be accessed through the `m`-variable.
    m.forEach((match, groupIndex) => {
      if (groupIndex === 0) return;
      iframeUrl = match;
    });
  }
  return iframeUrl;
}

function getSourceStreamOrIFrameUrl(responseWithIFrameTagOrScriptTag) {
  let result = null;
  if (responseWithIFrameTagOrScriptTag.includes("CryptoJS.AES.decrypt")) {
    const sourcePlayer = getSourcePlayerWithThanhHoaAtob(
      responseWithIFrameTagOrScriptTag
    );
    if (sourcePlayer) {
      result = {
        source: sourcePlayer,
        type: "source",
      };
    }
  } else if (responseWithIFrameTagOrScriptTag.includes("</iframe>")) {
    const urlIFrame = getIFrameSource(responseWithIFrameTagOrScriptTag);
    if (urlIFrame) {
      result = {
        source: urlIFrame,
        type: "iframe",
      };
    }
  }
  return result;
}

async function downloadVideoFromM3U8(
  urlM3U8,
  directory,
  episode,
  movieName,
  episodeId
) {
  return new Promise(async (rs) => {
    function saveM3U8ToFile(urlM3U8, directory) {
      return new Promise(async (rsParent) => {

        function handleM3U8ClgtLink(m3u8File) {
          return new Promise(async (resolve) => {
            const allLink = m3u8File.replace(
              /\.\.\/m3u8/g,
              "https://s2.clgt.link/hls/m3u8"
            );

            const matches = allLink.match(
              /https:\/\/s2\.clgt\.link\/hls\/m3u8\/.*/g
            );
            if (!matches) return resolve(null);
            const bestM3U8Source = matches[matches.length - 1];

            LogYellow(`---- Start Getting Best M3U8 Source, Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId} ---- `);
            let m3u8Source = await new Promise((resolveInner) => {
              axios
                .get(bestM3U8Source)
                .then((res) => resolveInner(res.data))
                .catch((err) => {
                  logger.error(`---- Error when get best m3u8 source, url M3U8: ${bestM3U8Source} Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId} ---- `);
                  logger.error(err.response ? err.response.data : err);
                  resolveInner(null)
                });
            });

            if (!m3u8Source) return resolve(null);

            m3u8Source = m3u8Source.replace(
              /vt1\.vnflare\.com/g,
              "s2.clgt.link"
            );

            return resolve(m3u8Source);
          });
        }
        LogYellow(`---- Start Get content M3U8 FILE, Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId} ---- `);
        let contentM3U8 = await new Promise((resolve) => {
          axios
            .get(urlM3U8)
            .then((res) => {
              resolve(res.data);
            })
            .catch((err) => {
              logger.error(`---- Error when get content M3U8 FILE, url M3U8: ${urlM3U8} Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId} ---- `);
              logger.error(err.response ? err.response.data : err);
              return resolve(null);
            });
        });

        if (!contentM3U8) return rsParent(null);

        // Handle special domain
        if (urlM3U8.includes("https://s2.clgt.link")){
          contentM3U8 = await handleM3U8ClgtLink(contentM3U8);
          if(!contentM3U8){
            logError(
              movieName,
              episode,
              episodeId,
              "File M3U8 content is empty in https://s2.clgt.link domain!"
            );
            return rsParent(null);
          }
        }

        // Write m3u8 file into local disk
        const m3u8FileName = await new Promise((resolve, reject) => {
          const fileName = `${uuid()}.m3u8`;
          fs.writeFile(`${directory}/${fileName}`, contentM3U8, (err) => {
            if (err) {
              logError(
                movieName,
                episode,
                episodeId,
                "Error while write M3U8 File to directory!"
              );
              logger.error(err);
              return resolve(null);
            }
            return resolve(fileName);
          });
        });

        if (!m3u8FileName) return rsParent(null);

        return rsParent(m3u8FileName);
      });
    }

    const m3u8File = await saveM3U8ToFile(urlM3U8, directory);
    if (!m3u8File) {
      logError(
        movieName,
        episode,
        episodeId,
        "Can't save m3u8 file to local disk!"
      );
      return rs(null);
    }

    // Download video with m3u8 file
    LogYellow(`---- Start Download video with m3u8 file, Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId} ---- `);
    const exec = childProcess.exec;
    const cmd = `ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto -i "${directory}/${m3u8File}" -bsf:a aac_adtstoasc -vcodec copy -c copy -crf 50 "${directory}/${episode}".mp4`;

    exec(cmd, function (err, stdout, stderr) {
      try {
        fs.unlink(`${directory}/${m3u8File}`, () => {});
      } catch (err) {
        logError(
          movieName,
          episode,
          episodeId,
          "Error while Remove M3U8 File After download success!"
        );
        logger.error(err);
      }
      if (err) {
        logError(movieName, episode, episodeId, "Error while compile m3u8 to video with ffmpeg!");
        logger.error(err);
        return rs(null);
      }
      LogGreen(`---- Download video with m3u8 file success, Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId} ---- `);
      return rs(`${episode}.mp4`);
    });
  });
}

function downloadVideo(
  sourceLinkOrStream,
  directory,
  episode,
  movieName,
  episodeId
) {
  // Check if m3u8 file or not
  if (sourceLinkOrStream.includes(".m3u8")) {
    return downloadVideoFromM3U8(
      sourceLinkOrStream,
      directory,
      episode,
      movieName,
      episodeId
    );
  } else {
    // Direct source video
    return new Promise(async (resolve) => {
      LogYellow(`---- Start Downloading Source Video, Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId} ---- `);
      const response = await fetch(sourceLinkOrStream).catch((err) => {
        logError(movieName, episode, episodeId, "Error while get source video");
        logger.error(err.response ? err.response.data : err);
        return null;
      });

      if (!response) {
        return resolve(null);
      }
      const buffer = await response.buffer();
      fs.writeFile(`${directory}/${episode}.mp4`, buffer, () => {
        LogGreen(`Download success Source Video, Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId} ---- `);
        return resolve(`${episode}.mp4`);
      });
    });
  }
}

export const getSourceVideo = async (
  episodeId,
  serverId,
  movieName,
  episode,
  directory
) => {
  return new Promise(async (rs) => {
    const urlGetPlayer = "https://anime47.com/player/player.php";

    LogYellow(`---- Start Getting Player information, Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId} ---- `);
    // Get Player
    const response = await new Promise((resolve) => {
      fetch(urlGetPlayer, {
        headers: {
          accept: "text/plain, */*; q=0.01",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          pragma: "no-cache",
          "sec-ch-ua":
            '"Chromium";v="88", "Google Chrome";v="88", ";Not A Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest",
          cookie: process.env.Cookie,
        },
        referrerPolicy: "no-referrer",
        body: `ID=${episodeId}&SV=${serverId}`,
        method: "POST",
        mode: "cors",
      })
        .then((res) => res.text())
        .then((body) => {
          if (!body) {
            logError(
              movieName,
              episode,
              episodeId,
              "Error, body get player empty"
            );
            return resolve(null);
          }
          return resolve(body);
        })
        .catch((err) => {
          logError(movieName, episode, episodeId, "Error when get player.php");
          logger.error(err.response ? err.response.data : err);
          resolve(null);
        });
    });

    if(!response){
      return rs(null);
    }

    // Get M3U8 Content or source video (DB) or iframe url
    const source = getSourceStreamOrIFrameUrl(response);
    if (!source) {
      logError(movieName, episode, episodeId, "Source type in identity");
      return rs(null);
    }

    if (source.type !== "source" && source.type !== "iframe") {
      logError(movieName, episode, episodeId, "Source type in identity in code part");
      return rs(null);
    }

    let result = null;
    if (source.type === "source") {
      // Check if video is download already
      if(fs.existsSync(`${directory}/${episode}.mp4`)){
        result = true;
        return rs(result);
      }
      result = await downloadVideo(
        source.source,
        directory,
        episode,
        movieName,
        episodeId
      );
      return rs(result);
    } else if (source.type === "iframe") {
      const textWriteToFile = `${source.source}   - Type: iframe | Episode: ${episode} | Episode Id: ${episodeId}\n`;
      fs.appendFile( directory + '/link_embed.txt', textWriteToFile, function (err) {
        if (err) {
          logger.error(`---- Error in write video embed url to file, Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId} ---- `)
          logger.error(err);
          return rs(null);
        }
        LogGreen(`---- Add video embed  success, Movie name: ${movieName}, Episode: ${episode}, Episode Id: ${episodeId} ---- `);
        return rs(true);
      });
    } else {
      logError(movieName, episode, episodeId, "Source type in identity");
      return rs(null);
    }
   
  });
};

function logError(movieName, episode, episodeId, message) {
  logger.error(
    `${message}, Movie Name: ${movieName}, Episode: ${episode}, episodeId:${episodeId} `
  );
}

