var fs = require('fs')
var moment = require('moment')
var request = require('request')

function removeDuplicates(array) {
    var uniq_array = array.reduce(function(a, b) {
        if (a.indexOf(b) < 0) a.push(b)
        return a
    }, [])
    return uniq_array
}

function removeByRegEx(originalArray, regex) {
    var j = 0
    while (j < originalArray.length) {
        if (regex.test(originalArray[j]))
            originalArray.splice(j, 1)
        else
            j++
    }
    return originalArray
}

function arrayToFile(array, array_name, writeStream) {
    writeStream.write('\n' + array_name + ' = [')
    for (var key in array) {
        writeStream.write('"' + array[key] + '",')
    }
    writeStream.write(']')
}

function parseDump(filename) { //parse ip adresses from file
    var fs = require('fs')
    fs.readFile(filename, 'utf8', function(err, data) {
        if (err) {
            return console.log(err)
        }
        var regex_ip = /(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\s)/g
        var regex_url = /(www\.){0,1}[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,5}[\.]{0,1}/g
        var ips = data.match(regex_ip)
        var urls = data.match(regex_url)
        for (var key in ips) {
            ips[key] = ips[key].slice(0, -1)
        }
        ips = removeDuplicates(ips)
        urls = removeDuplicates(urls)
        urls = removeByRegEx(urls, /.php$|.html?$|.jpe?g$|.png$|.gif$|.pdf$|.swf$|.wml$/) // cleaning some trash

        build_pac(__dirname + '/static/proxy_new.pac', ips, urls) // generate pac-file

        fs.rename(__dirname + '/static/proxy_new.pac', process.env.PROXYPAC_PATH)
    })
}

function build_pac(filename, ips, urls) { // .pac-file builder
    console.log('generating new proxy pac')

    var file = fs.createWriteStream(filename)
    file.write('// proxypac_gen_russia, autogenerated on ' + moment().utc().add(3, 'h').format('LLL') + ' (MSK)\n')
    file.write('// ' + ips.length + ' IPs and ' + urls.length + ' domains in list\n\n')
    file.write('function FindProxyForURL(url, host) {')

    arrayToFile(ips, 'blocked_ips', file)
    arrayToFile(urls, 'blocked_urls', file)

    file.write('\n\n  if ((blocked_ips.indexOf(dnsResolve(host)) != -1) || (blocked_urls.indexOf(host) != -1)) {\n    return "' + process.env.PROXYSTRING + ' DIRECT"\n  }\n  if (dnsDomainIs(host, ".onion")) {\n    return "SOCKS5 127.0.0.1:9050 DIRECT" // tor proxy\n  }\n  if (dnsDomainIs(host, ".i2p")) {\n    return "PROXY 127.0.0.1:4444" // i2p proxy\n  }\n\n  return "DIRECT"\n}')
    file.end()
    console.log('.pac file generated successfully at ' + moment().format('LLL'))
}

function generate_pac(dump_url) {
    var file = fs.createWriteStream('dump.txt')
    var r = request(dump_url).pipe(file)
    r.on('finish', function() {
        parseDump('dump.txt')
    })
}

module.exports = generate_pac
