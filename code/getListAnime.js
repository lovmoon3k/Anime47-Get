import axios from "axios";
import fs from "fs";
import slugify from "slugify";

import logger, { LogGreen, LogYellow, LogMagenta } from "../config/logger.js";
import "../config/loadEnv.js";

import { GetDetailAnime } from "./getAnimePage.js";

function getListDetailLink(htmlPage) {
  const regex = /<a class=\"movie-item m-block\" title=\"(.*?)\" href=\"(.*?)\">/gs;
  const str = htmlPage;
  let m;
  const links = [];

  while ((m = regex.exec(str)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    let linkDetail = {
      title: null,
      link: null,
    };

    // The result can be accessed through the `m`-variable.
    m.forEach((match, groupIndex) => {
      if (groupIndex === 0) return;
      // Name anime
      if (groupIndex === 1) linkDetail.title = match;
      else if (groupIndex === 2)
        linkDetail.link = encodeURI(
          "https://anime47.com" + match.replace("./phim", "/phim")
        );
    });
    if (linkDetail.title && linkDetail.link) links.push(linkDetail);
  }

  return links;
}

export async function start(startPage, endPage) {
  for (let page = startPage; page <= endPage; page++) {
    logger.silly("Page " + page);
    LogMagenta(
      `-------------------- Getting Page ${page} ...... ----------------------`
    );
    const url = `https://anime47.com/tim-nang-cao/?status=&season=&year=&sort=&page=${page}`;
    const response = await axios({
      url: url,
      method: "GET",
      headers: {
        Cookie: process.env.Cookie,
      },
    })
      .then((res) => res.data)
      .catch((err) => {
        logger.error("Error while get page 1");
        logger.error(err.response ? err.response.data : err);
        logger.warn("Page: " + url);
        return null;
      });

    if (!response) return;

    const links = getListDetailLink(response);

    // Check if link not empty
    if(links.length <= 0) {
      LogMagenta(
        `-------------------- Not found any link in url:${url} ----------------------`
      );
    }
    else{
       // Get anime from each links
      GetDetailAnimeFromLinks(links);
    }
    await sleep(3000);
    LogMagenta(
        `-------------------- Waiting 3 seconds for next page, next page: ${Number(page) + 1} ...... ----------------------`
    );
  }

  LogMagenta("-------------------- SUCCESS RUN ALL ----------------------------------------------");
}

async function GetDetailAnimeFromLinks(links){
  for (const link of links) {
    GetDetailAnime(link.link);
    LogMagenta(
        `-------------------- Waiting 3 seconds for next anime, current anime: ${link.title}, url: ${link.link} ...... ----------------------`
    );
    await sleep(3000);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, process.env.DELAY_TIME);
  });
}
