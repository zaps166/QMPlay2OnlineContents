var g_apiBase = "https://api.myfreemp3.ink"
var g_origin = "https://myfreemp3.ink"
var g_name = "MyFreeMP3"

var g_signing = {
    key_id: "",
    signing_key: "",
    clock_offset: 0,
    expires_at: 0,
}
var g_bootstrapDone = false

var g_urlNames = []
var g_treeW = null

/**/

function doBootstrapHeaders()
{
    return [
        "X-Requested-With: XMLHttpRequest",
        "Accept-Encoding: identity",
        "Origin: " + g_origin,
        "Referer: " + g_origin + "/",
    ]
}

function parseBootstrapData(data)
{
    var obj = JSON.parse(data)
    g_signing.key_id = obj.key_id
    g_signing.signing_key = obj.signing_key
    g_signing.expires_at = obj.expires_at
    if (obj.server_time)
        g_signing.clock_offset = obj.server_time - Math.floor(Date.now() / 1000)
    g_bootstrapDone = true
}

function isBootstrapExpired()
{
    return g_bootstrapDone && Math.floor(Date.now() / 1000) >= g_signing.expires_at - 60
}

/**/

function getInfo()
{
    return {
        version: 21,
        name: g_name,
        icon: ":/applications-multimedia.svgz",
    }
}

function prepareWidget(treeW)
{
    treeW.sortByColumn(0, SortOrder.AscendingOrder)

    treeW.setHeaderItemText(0, "Title")
    treeW.setHeaderItemText(1, "Artist")
    treeW.setHeaderItemText(2, "Length")

    treeW.setHeaderSectionResizeMode(2, ResizeMode.ResizeToContents)

    g_treeW = treeW
}

function init(ioCtrl)
{
    if (isBootstrapExpired())
        g_bootstrapDone = false
    if (g_bootstrapDone)
        return 0
    const url = g_apiBase + "/api/signing/bootstrap"
    if (ioCtrl)
    {
        var result = self.network().startAndWait({
            url: url,
            headers: doBootstrapHeaders(),
        }, ioCtrl)
        if (result.ok && result.reply)
            parseBootstrapData(result.reply)
        return 0
    }
    return self.network().start({
        url: url,
        headers: doBootstrapHeaders(),
    }, function(error, replyData) {
        if (error === 0 && replyData)
            parseBootstrapData(replyData)
    })
}

function finalize()
{
    for (var i = 0; i < g_urlNames.length; ++i)
        common.addNameForUrl(g_urlNames[i], "")
    g_urlNames = []
}

function getQMPlay2Url(text)
{
    return g_name + "://{" + text + "}"
}

/**/

function sign(method, path, query)
{
    var now = Math.floor(Date.now() / 1000) + g_signing.clock_offset
    var q = query || ""
    if (q.length > 0 && q.charAt(0) !== "?")
        q = "?" + q

    var message = now + "\n" + method + "\n" + path + "\n" + q
    var sig = common.toHex(common.hmacSha256(g_signing.signing_key, message))

    return {
        key_id: g_signing.key_id,
        ts: "" + now,
        sig: sig,
    }
}

function buildSignedHeaders(method, path, query)
{
    var h = sign(method, path, query)
    return [
        "X-Requested-With: XMLHttpRequest",
        "Accept-Encoding: identity",
        "X-Api-Key-Id: " + h.key_id,
        "X-Api-Ts: " + h.ts,
        "X-Api-Sig: " + h.sig,
        "Origin: " + g_origin,
        "Referer: " + g_origin + "/",
    ]
}

function normalizeUrl(url)
{
    return url.replace(/v4s1\.myfreemp3\.ink/g, "v4.s1.myfreemp3.ink")
}

function encQuery(str)
{
    var utf8 = unescape(encodeURIComponent(str))
    return utf8.replace(/./g, function(c)
    {
        var hex = c.charCodeAt(0).toString(16).toUpperCase()
        return "%" + (hex.length < 2 ? "0" : "") + hex
    })
}

/**/

function getSearchReply(text, page)
{
    if (!g_bootstrapDone)
        return 0

    var path = "/search/" + encQuery(text)
    var decodedPath = "/search/" + text
    var query = page > 1 ? "?page=" + page : ""
    return self.network().start({
        url: g_apiBase + path + query,
        headers: buildSignedHeaders("GET", decodedPath, query),
    })
}

function addSearchResults(reply)
{
    var chunks = reply.split('<li class="track')
    if (chunks.length < 2)
        return {}

    var attrRe = /data-(\w[\w-]*)="([^"]*)"/g
    var artistRe = /<(?:div|li)[^>]*class="track-artist"[^>]*>[\s\S]*?<(?:span|a)[^>]*>([\s\S]*?)<\/(?:span|a)>/
    var titleRe = /<(?:div|li)[^>]*class="track-title"[^>]*>[\s\S]*?<(?:span|a)[^>]*>([\s\S]*?)<\/(?:span|a)>/
    var durationRe = /track-duration">(.*?)<\/span>/

    for (var i = 1; i < chunks.length; ++i)
    {
        var chunk = chunks[i]
        if (chunk.indexOf("data-download") === -1)
            continue

        var ownerId = ""
        var trackId = ""

        var m
        attrRe.lastIndex = 0
        while ((m = attrRe.exec(chunk)) !== null)
        {
            var key = m[1]
            var val = m[2]
            if (key === "owner-id")  ownerId = val
            if (key === "track-id")  trackId = val
        }

        if (!ownerId || !trackId)
            continue

        var artist = ""
        var am = artistRe.exec(chunk)
        if (am)
            artist = common.fromHtml(am[1]).trim()

        var title = ""
        var tm = titleRe.exec(chunk)
        if (tm)
            title = common.fromHtml(tm[1]).trim()

        var duration = ""
        var dm = durationRe.exec(chunk)
        if (dm)
            duration = dm[1].trim()

        var fullName = artist + " - " + title

        var tWI = new QTreeWidgetItem()
        tWI.setData(0, ItemDataRole.UserRole + 1, fullName)
        var roleData = common.base64Encode(JSON.stringify({a: artist, t: title, id: trackId}))
        tWI.setData(0, ItemDataRole.UserRole, roleData)

        tWI.setText(0, title)
        tWI.setToolTip(0, title)

        tWI.setText(1, artist)
        tWI.setToolTip(1, artist)

        tWI.setText(2, duration)

        g_treeW.addTopLevelItem(tWI)

        var url = getQMPlay2Url(roleData)
        common.addNameForUrl(url, fullName, false)
        g_urlNames.push(url)
    }

    return {}
}

/**/

function pagesMode()
{
    return PagesMode.Multi
}
function getPagesList()
{
    return []
}

function hasWebpage()
{
    return false
}
function getWebpageUrl(text)
{
    return ""
}

function completerMode()
{
    return CompleterMode.None
}
function getCompleterReply(text)
{
    return 0
}
function getCompletions(reply)
{
    return []
}
function completerListCallbackSet()
{
}

function hasAction()
{
    return true
}

function extractHlsUrl(html, trackId)
{
    var chunks = html.split('<li class="track')
    for (var i = 1; i < chunks.length; ++i)
    {
        var chunk = chunks[i]
        if (chunk.indexOf('data-track-id="' + trackId + '"') === -1)
            continue
        var re = /data-download="([^"]*)"/
        var m = re.exec(chunk)
        if (m)
            return normalizeUrl(m[1])
    }
    return null
}

function convertAddress(prefix, url, param, nameAvail, extensionAvail, ioCtrl)
{
    init(ioCtrl)
    if (!g_bootstrapDone)
        return { url: "", name: "", extension: "" }

    if (url.startsWith("http://"))
        url = url.replace("http://", "")

    var data = JSON.parse(common.base64Decode(url))

    var artist = data.a
    var title = data.t
    var trackId = data.id

    var query = artist + " " + title
    var path = "/search/" + encQuery(query)
    var decodedPath = "/search/" + query
    var result = self.network().startAndWait({
        url: g_apiBase + path,
        headers: buildSignedHeaders("GET", decodedPath, ""),
    }, ioCtrl)

    if (result.ok && result.reply)
    {
        var hlsUrl = extractHlsUrl(result.reply, trackId)
        if (hlsUrl)
            return { url: hlsUrl, name: artist + " - " + title, extension: extensionAvail ? ".m3u8" : "" }
    }

    return { url: "", name: "", extension: "" }
}
