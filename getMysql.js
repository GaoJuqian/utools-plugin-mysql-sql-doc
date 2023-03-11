const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// https://dev.mysql.com/doc/refman/5.7/en/sql-statements.html // 第 13 章 SQL 语句
class GetMysqlConfig {
    BaseUrl = 'https://dev.mysql.com/doc/refman/5.7/en/';
    // indexes.json
    static indexes = [];
    // 判断是否写入过某一个章节
    static chaptersNumMap = new Map();
    // 防止http 403
    static sleep = (milliseconds) => {
        return new Promise(resolve => setTimeout(resolve, milliseconds))
    }
}


class GetMysql extends GetMysqlConfig {
    url = '';
    sourceHtml = '';
    cheerioHtml = '';

    constructor(pageUrl) {
        super();
        this.url = this.BaseUrl + pageUrl;
    }

    async getPageRequest() {
        try {
            const response = await axios(this.url);
            this.sourceHtml = response.data;
            this.getPageHtml();
            return this.cheerioHtml;
        } catch (err) {
            console.error(err);
            throw err;
        }

    }

    getPageHtml() {
        this.cheerioHtml = cheerio.load(this.sourceHtml);
    }
}

const handleSinglePage = async (cheerioHtml) => {

    let singlePageData = {
        t: "",
        d: "",
        p: "",
    };
    let outHtml = "";
    const docsBody = cheerioHtml("#docs-body");

    // 标题
    const title = cheerio.load(docsBody.html())(".titlepage .title");
    const titleText = title.text();
    // 分割文章标题中的章节号和章节标题（&nbsp;）
    const [chaptersNum, chaptersTitle] = titleText.split(/\u{00A0}/u);
    // 避免重复写入
    if (GetMysqlConfig.chaptersNumMap.has(chaptersNum)) {
        console.log("已经存在", chaptersNum, chaptersTitle);
        return;
    }
    GetMysqlConfig.chaptersNumMap.set(chaptersNum, chaptersTitle);
    // indexes.json信息
    singlePageData.t = chaptersTitle; // 章节文字
    singlePageData.d = titleText; // TODO 优化描述
    // 去除 / 和 限制长度 生成路径
    singlePageData.p = `doc/en/${chaptersTitle?.replace(/\//, ' ').slice(0, 245) || titleText}.html`;

    // 导航
    const toc = cheerio.load(docsBody.html())(".toc .toc");
    if (toc.length > 0) {
        const toc = cheerio.load(docsBody.html())(".toc a");

        for (let i = 0; i < toc.length; i++) {
            const pageUrl = toc[i].attribs.href;
            await GetMysql.sleep(10000);
            new GetMysql(pageUrl).getPageRequest().then(handleSinglePage);
        }
    }

    // 文章
    const section = cheerioHtml("#docs-body>.section");
    if (section.length > 0) {
        outHtml = docsBody.html();
    }


    // TODO 描述
    // const desc = cheerio.load(docsBody.html())(".section>.language-sql:nth-child(1)");
    // const descText = desc.text();
    // console.log(descText)


    outData(singlePageData, outHtml);

}

const insterHtml = (outHtml, singlePageData) => {
    return `<!DOCTYPE html>
<html lang="zh-Hant-CN">
<head>
<meta charset="UTF-8">
<title>${singlePageData.t}</title>
<link href="../docs.css" rel="stylesheet">
</head>
<body>
${outHtml}
</body>
</html>`
}

const outData = (singlePageData, outHtml) => {
    GetMysqlConfig.indexes.push(singlePageData);
    fs.writeFile(`./mysql/indexes.json`, JSON.stringify(GetMysqlConfig.indexes), function (err) {
        if (err) throw err;
        console.log(`indexes.json - ok!`);
    });
    fs.writeFile(`./mysql/${singlePageData.p}`, insterHtml(outHtml, singlePageData), function (err) {
        if (err) throw err;
        console.log(`${singlePageData.p} - ok!`);
    });
}


// start
const getMysql = new GetMysql('sql-statements.html');
getMysql.getPageRequest().then(handleSinglePage);



