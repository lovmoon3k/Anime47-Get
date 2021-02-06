import axios from "axios";
import './config/loadEnv.js';

import {start} from './code/getListAnime.js';

function init(){
    const startPage = process.env.START_PAGE;
    const endPage = process.env.END_PAGE;
    
    if(!startPage || !endPage || isNaN(startPage) || isNaN(endPage)) {
        console.error(`Please define START_PAGE and END_PAGE correctly, got START_PAGE: ${startPage}, END_PAGE: ${endPage}`);
        return;
    }

    start(Number(startPage), Number(endPage));
}


init();