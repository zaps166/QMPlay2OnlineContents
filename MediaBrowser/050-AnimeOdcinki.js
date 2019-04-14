var g_url = "https://anime-odcinki.pl/anime/"
var g_name = "AnimeOdcinki"

var g_network = common.newNetworkAccess(engine)
var g_animeListReplyId = 0
var g_animeList = []
var g_currentAnime = ""
var g_urlNames = []
var g_treeW = null

/**/

function getInfo()
{
    return {
        version: 1,
        name: g_name,
        icon: ":/video.svgz",
    }
}

function prepareWidget(treeW)
{
    treeW.setHeaderItemText(0, "Episode name")

    g_currentAnime = ""
    g_treeW = treeW
}

function finalize()
{
    for (var i = 0; i < g_urlNames.length; ++i)
        common.addNameForUrl(g_urlNames[i], "")
    g_urlNames = []
}

function getQMPlay2Url(text)
{
    return g_name + "://{" + getWebpageUrl(text) + "}"
}

function getSearchReply(text, page)
{
    g_currentAnime = ""
    for (var i = 0; i < g_animeList.length; ++i)
    {
        if (g_animeList[i].title == text)
        {
            g_currentAnime = g_animeList[i].suffix
            break
        }
    }
    if (g_currentAnime != "")
        return self.network().start(g_url + g_currentAnime)
    return 0
}
function addSearchResults(reply)
{
    var episodeImgDescr = {}
    var animeList = parseAnimeList(reply, episodeImgDescr)
    for (var i = 0; i < animeList.length; ++i)
    {
        var urlSuffix = g_currentAnime + "/" + animeList[i].suffix

        var tWI = common.newQTreeWidgetItem(engine)
        tWI.setData(0, ItemDataRole.UserRole, urlSuffix)
        tWI.setText(0, animeList[i].title)
        g_treeW.addTopLevelItem(tWI)

        var url = getQMPlay2Url(urlSuffix)
        common.addNameForUrl(url, animeList[i].title, false)
        g_urlNames.push(url)
    }
    return {
        description: episodeImgDescr.description,
        imageReply: self.network().start(episodeImgDescr.imgUrl),
    }
}

function pagesMode()
{
    return PagesMode.Single
}
function getPagesList()
{
    return []
}

function hasWebpage()
{
    return true
}
function getWebpageUrl(text)
{
    return g_url + text
}

function completerMode()
{
    return CompleterMode.All
}
function getCompleterReply(text)
{
    return 0
}
function getCompletions(reply)
{
    var completions = []
    for (var i = 0; i < g_animeList.length; ++i)
        completions.push(g_animeList[i].title)
    return completions
}
function completerListCallbackSet()
{
    if (!self.hasCompleterListCallback())
        return

    if (g_animeList.length <= 0 && g_animeListReplyId == 0)
    {
        g_animeListReplyId = g_network.start(g_url, gotAnimeList)
    }
    else if (g_animeList.length > 0)
    {
        self.completerListCallback()
        self.resetCompleterListCallback()
    }
}

function hasAction()
{
    return false
}

function convertAddress(prefix, url, param, nameAvail, extensionAvail, ioCtrl)
{
    var animeName = ""
    var streamUrl = ""
    var extension = ""

    var net = common.newNetworkAccess(engine)
    net.setMaxDownloadSize(0x200000 /* 2 MiB */)

    var result = net.startAndWait(url, ioCtrl)
    if (result.ok)
    {
        var reply = result.reply

        var hasName = false
        if (nameAvail)
        {
            var idx1 = reply.indexOf("page-header")
            if (idx1 > -1)
            {
                idx1 = reply.indexOf(">", idx1)
                if (idx1 > -1)
                {
                    idx1 += 1

                    var idx2 = reply.indexOf("<", idx1)
                    if (idx2 > -1)
                    {
                        animeName = common.fromHtml(reply.substr(idx1, idx2 - idx1))
                        if (animeName.length > 0)
                            hasName = true
                    }
                }
            }
        }

        var hasStreamUrl = false
        var error = ""

        function getStreamUrl(animeUrl) {
            var result = common.youTubeDlFixUrl(animeUrl, ioCtrl, false, extensionAvail, true)
            if (!result.ok)
                return false
            streamUrl = result.url
            if (extensionAvail)
                extension = result.extension
            error = result.error
            return true
        }

        if (extensionAvail && !common.isIOControllerAborted(ioCtrl)) // Download only
        {
            if (extension.length <= 0)
                extension = ".mp4" // Probably all videos here have MP4 file format
        }

        if (!hasStreamUrl && !common.isIOControllerAborted(ioCtrl))
        {
            var embeddedPlayers = getEmbeddedPlayers(reply)
            for (var i = 0; i < embeddedPlayers.length; ++i)
            {
                var playerUrl = decryptUrl(embeddedPlayers[i].v, embeddedPlayers[i].a)
                if (playerUrl && playerUrl != "")
                {
                    if (playerUrl.indexOf("gamedor.usermd.net") > -1)
                    {
                        result = net.startAndWait(
                            {
                                url: playerUrl,
                                headers: [
                                    "Referer: " + url
                                ],
                            },
                            ioCtrl
                        )
                        if (result.ok)
                        {
                            playerUrl = getGamedorUsermdUrl(result.reply)
                            if (playerUrl == "")
                                continue
                        }
                    }
                    hasStreamUrl = getStreamUrl(playerUrl)
                    if (hasStreamUrl)
                        break
                }
            }
        }

        if (!hasStreamUrl && error.length > 0 && !common.isIOControllerAborted(ioCtrl))
            common.sendMessage(error, g_name, 3, 0)
    }

    return {
        url: streamUrl,
        name: animeName,
        extension: extension,
    }
}

/**/

function getGamedorUsermdUrl(data)
{
    var idx1 = data.indexOf("iframe")
    if (idx1 > -1)
    {
        idx1 = data.indexOf("src=\"", idx1)
        if (idx1 > -1)
        {
            idx1 += 5

            var idx2 = data.indexOf("\"", idx1)
            if (idx2 > -1)
                return common.fromHtml(data.substr(idx1, idx2 - idx1))
        }
    }
    return ""
}

function decryptUrl(saltHex, cipheredBase64)
{
    return JSON.parse("{\"url\":" + common.decryptAes256Cbc(
        common.fromBase64("czA1ejlHcGQ9c3lHXjd7"),
        common.fromHex(saltHex),
        common.fromBase64(cipheredBase64)
    ) + "}").url
}

function getEmbeddedPlayers(data)
{
    ret = []

    for (var pos = 0; ;)
    {
        var idx1 = data.indexOf("data-hash='", pos)
        if (idx1 < 0)
            break

        idx1 += 11

        var idx2 = data.indexOf("'", idx1)
        if (idx2 < 0)
            break

        var json = JSON.parse(data.substr(idx1, idx2 - idx1))
        if (json)
        {
            idx1 = idx2 + 2
            idx2 = data.indexOf("<", idx1)
            if (idx2 > -1)
            {
                var name = data.substr(idx1, idx2 - idx1).trim().toLowerCase()
                var idx = name.indexOf(" ")
                if (idx > -1)
                    name = name.substr(0, name.indexOf(" "))
                if (name == "google")
                    ret.unshift(json)
                else
                    ret.push(json)
            }
        }

        pos = idx2
    }

    return ret
}

function parseAnimeList(data, episodeImgDescr)
{
    var idx1 = 0, idx2 = 0

    function getRange(data, first, second, preFirst) {
        if (preFirst != null)
        {
            idx1 = data.indexOf(preFirst)
            if (idx1 < 0)
                return false
        }
        idx1 = data.indexOf(first, idx1)
        if (idx1 < 0)
            return false
        idx1 += first.length
        idx2 = data.indexOf(second, idx1)
        if (idx2 < 0)
            return false
        return true
    }

    if (episodeImgDescr)
    {
        if (!getRange(data, "<ul>", "</ul>", "view-id-lista_odcink_w view-display-id-block"))
            return []
    }
    else
    {
        if (!getRange(data, "<tbody>", "</tbody>"))
            return []
    }

    var animeList = []

    var animeTable = data.substr(idx1, idx2 - idx1)
    idx1 = 0
    for (;;)
    {
        if (!getRange(animeTable, "<a href=\"", "\""))
            break

        var url = animeTable.substr(idx1, idx2 - idx1)

        if (!getRange(animeTable, ">", "</a>"))
            break

        var title = animeTable.substr(idx1, idx2 - idx1)

        if (url != "" && title != "")
        {
            animeList.push({
                title: common.fromHtml(title),
                suffix: decodeURI(url.substr(url.lastIndexOf("/") + 1)),
            })
        }
    }

    if (episodeImgDescr)
    {
        if (getRange(data, "<img src=\"", "\"", "field-name-field-okladka"))
            episodeImgDescr.imgUrl = data.substr(idx1, idx2 - idx1)
        if (getRange(data, "<p>", "</p>", "field-type-text-with-summary"))
            episodeImgDescr.description = common.fromHtml(data.substr(idx1, idx2 - idx1))
    }

    return animeList
}

function gotAnimeList(errorCode, data, cookie, id)
{
    if (errorCode == NetworkReplyError.Ok)
    {
        g_animeList = parseAnimeList(data, null)
        self.completerListCallback()
    }
    self.resetCompleterListCallback()
    g_animeListReplyId = 0
}
