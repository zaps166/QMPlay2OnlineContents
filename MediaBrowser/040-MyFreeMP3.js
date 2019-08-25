var g_baseUrl = "https://my-free-mp3s.com/"
var g_url = g_baseUrl + "api"
var g_name = "MyFreeMP3"
var g_headers = [
    self.network().urlEncoded(),
    "Referer: " + g_baseUrl + "mp3juice",
]
var g_queryId = "jQuery000000000000000000000_0000000000000"
var g_cookies = null

var g_urlNames = []
var g_treeW = null

/**/

function getInfo()
{
    return {
        version: 5,
        name: g_name,
        icon: ":/applications-multimedia.svgz",
    }
}

function prepareWidget(treeW)
{
    if (g_cookies == null)
    {
        var network = common.newNetworkAccess(engine)
        network.start(g_baseUrl, function(error, data, cookies) {
            g_cookies = cookies
        });
    }

    treeW.sortByColumn(0, SortOrder.AscendingOrder)

    treeW.setHeaderItemText(0, "Title")
    treeW.setHeaderItemText(1, "Artist")
    treeW.setHeaderItemText(2, "Length")

    treeW.setHeaderSectionResizeMode(2, ResizeMode.ResizeToContents)

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
    return g_name + "://{" + text + "}"
}

function getSearchReply(text, page)
{
    var headers = g_headers
    headers.push("Cookie: " + g_cookies + " musicLang=en")
    return self.network().start({
        url: g_url + "/search.php?callback=" + g_queryId,
        post: "q=" + encodeURI(text) + "&page=" + (page - 1),
        headers: headers,
    })
}
function addSearchResults(reply)
{
    var jsonArray = JSON.parse(reply.substr(g_queryId.length + 1, reply.length - 2 - g_queryId.length - 1)).response
    if (jsonArray == null)
        return {}

    for (var i = 0; i < jsonArray.length; ++i)
    {
        var entry = jsonArray[i]
        if (typeof entry !== "object")
            continue

        var id = encode(entry.owner_id) + ":" + encode(entry.id)

        var title = entry.title
        var artist = entry.artist
        var fullName = artist + " - " + title

        var tWI = common.newQTreeWidgetItem(engine)
        tWI.setData(0, ItemDataRole.UserRole + 1, fullName)
        tWI.setData(0, ItemDataRole.UserRole, id)

        tWI.setText(0, title)
        tWI.setToolTip(0, title)

        tWI.setText(1, artist)
        tWI.setToolTip(1, artist)

        tWI.setText(2, common.timeToStr(entry.duration))

        g_treeW.addTopLevelItem(tWI)

        var url = getQMPlay2Url(id);
        common.addNameForUrl(url, fullName, false)
        g_urlNames.push(url)
    }

    return {}
}

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
    return CompleterMode.Continuous
}
function getCompleterReply(text)
{
    return self.network().start({
        url: g_url + "/autocomplete.php",
        post: "query=" + encodeURI(text),
        headers: g_headers,
    })
}
function getCompletions(reply)
{
    var completions = []
    try
    {
        var jsonArray = JSON.parse(reply)
        for (var i = 0; i < jsonArray.length; ++i)
        {
            var name = jsonArray[i].name
            if (name && name != "")
                completions.push(name)
        }
    }
    catch (e)
    {
    }
    return completions
}
function completerListCallbackSet()
{
}

function hasAction()
{
    return true
}

function convertAddress(prefix, url, param, nameAvail, extensionAvail, ioCtrl)
{
    var fullUrl = "https://s.playx.fun/stream/" + url
    common.addRawHeaders(fullUrl, "Referer: " + g_baseUrl + "mp3juice")
    return {
        url: fullUrl,
        name: "",
        extension: extensionAvail ? ".mp3" : "",
    }
}

/**/

function encode(input)
{
    var map = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvxyz123"

    if (input == 0)
        return map.substr(0, 1)

    var encoded = ""

    if (input < 0)
    {
        input *= - 1
        encoded += "-"
    }

    while (input > 0)
    {
        var idx = (input % map.length)
        input = Math.floor(input / map.length)
        encoded += map[idx]
    }

    return encoded
}
