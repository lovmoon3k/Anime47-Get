import CryptoJS from "crypto-js";
import atob from "atob";
import axios from "axios";
import fs from "fs";
import { v4 as uuid } from "uuid";
import logger from "../config/logger.js";
import "../config/loadEnv.js";

export function testSourcePlayer() {
  var DefaultParameter = [
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
  var CryptoJSAesJson = {
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

  var thanhhoa = atob(
    "eyJjdCI6IjBUbkdEcE5KcEl3NU1QRnVBQStvU1Z4SXYxdHBiWXFLVnZ0a0Q0Y0pNZFA3NDFoU2xmcnRUcE1OcVN1b3loaUJSb2VXNzlScG1uQlZtSm9hOFNyR1BJaFwvZ0Z5bmgzSDN3bm8rdmxpYmx0bDhaU21HWWJPSnZqdGROMkI4aThCUCIsIml2IjoiNWEzY2EwMDU0MjMwM2Q1ZTFmYzdjNDkxZjQ3YzcwYjkiLCJzIjoiMWYzMWI4OTZiYTMwNTQzNyJ9"
  );
  var daklak = JSON.parse(
    CryptoJS.AES.decrypt(thanhhoa, "caphedaklak", {
      format: CryptoJSAesJson,
    }).toString(CryptoJS.enc.Utf8)
  );
  console.log("result");
  console.log(daklak);
}

export async function downloadM3U8ToFile(urlM3U8, directory) {
  function handleM3U8ClgtLink(m3u8File) {
    return new Promise(async (resolve) => {
      const allLink = m3u8File.replace(
        /\.\.\/m3u8/g,
        "https://s2.clgt.link/hls/m3u8"
      );

      const matches = allLink.match(/https:\/\/s2\.clgt\.link\/hls\/m3u8\/.*/g);
      if (!matches) return null;
      const bestM3U8Source = matches[matches.length - 1];

      let m3u8Source = await new Promise(resolveInner => {
        axios.get(bestM3U8Source)
        .then((res) => resolveInner(res.data))
        .catch(err => resolveInner(null))
      });

      if(!m3u8Source) return resolve(null);

      m3u8Source = m3u8Source.replace(
        /vt1\.vnflare\.com/g,
        "s2.clgt.link"
      );

      return resolve(m3u8Source);
    });
  }

  let contentM3U8 = await new Promise((resolve) => {
    axios
      .get(urlM3U8)
      .then((res) => {
        resolve(res.data);
      })
      .catch((err) => resolve(null));
  });

  if (!contentM3U8) return;

  if (urlM3U8.includes("https://s2.clgt.link"))
    contentM3U8 = await handleM3U8ClgtLink(contentM3U8);

  const m3u8FileName = await new Promise((resolve, reject) => {
    const fileName = `${uuid()}.m3u8`;
    fs.writeFile(`${directory}/${fileName}`, contentM3U8, (err) => {
      if (err) {
        console.log(err);
        return resolve(null);
      }
      resolve(fileName);
    });
  });

  if (!m3u8FileName) return null;

  return m3u8FileName;
}

