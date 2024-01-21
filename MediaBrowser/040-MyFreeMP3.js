var g_baseUrl = "https://2024.myfreemp3juices.cc/"
var g_url = g_baseUrl + "api"
var g_name = "MyFreeMP3"
var g_headers = [
    self.network().urlEncoded(),
    "Referer: " + g_baseUrl,
]

var g_urlNames = []
var g_treeW = null

/**/

function getInfo()
{
    return {
        version: 19,
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
    return self.network().start({
        url: g_url + "/api_search.php?callback=jQuery000000000000000000000_0000000000000",
        post: "q=" + encodeURI(text) + "&page=" + (page - 1),
        headers: g_headers,
    })
}
function addSearchResults(reply)
{
    var jsonArray = JSON.parse(reply.substr(42, reply.lastIndexOf("}") - 42 + 1)).response
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

        var tWI = new QTreeWidgetItem()
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
    return CompleterMode.None
}
function getCompleterReply(text)
{
    return 0
}
function getCompletions(reply)
{
    var completions = []
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
    var fullUrl = "https://nplay.idmp3s.xyz/stream/" + url
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
