/*
    GFWList to Privoxy Action File Converter v0.2.1
    http://github.com/vilic/x-wall

    This converter is part of X-Wall project and it fetches GFWList
    from the Internet directly.

    X-Wall is a small tool wrapped Privoxy and Plink together to provide people an easier way to X the wall.
    
    Copyright 2012, VILIC VANE
    Licensed under the MIT license.
*/

//possible value for forwardString
var fileNames = ["gfwlist.action"];
var forwardStrings = ["{+forward-override{forward-socks5 127.0.0.1:1080 .}}"];
var donnotForwardStrings = ["{+forward-override{forward .}}"];

"BASE 64 DECODER",
function () {
    var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

    this.decode64 = function (input) {
        var output = "";
        var chr1, chr2, chr3 = "";
        var enc1, enc2, enc3, enc4 = "";
        var i = 0;

        // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
        var base64test = /[^A-Za-z0-9\+\/\=]/g;
        if (base64test.exec(input)) { }
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        do {
            enc1 = keyStr.indexOf(input.charAt(i++));
            enc2 = keyStr.indexOf(input.charAt(i++));
            enc3 = keyStr.indexOf(input.charAt(i++));
            enc4 = keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output = output + String.fromCharCode(chr1);

            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }

            chr1 = chr2 = chr3 = "";
            enc1 = enc2 = enc3 = enc4 = "";

        } while (i < input.length);

        return output;
    };
}();

var xhr = new ActiveXObject("MSXML2.XMLHTTP");
xhr.open("get", "https://autoproxy-gfwlist.googlecode.com/svn/trunk/gfwlist.txt", false);
xhr.send();
var text = decode64(xhr.responseText);

var hash = {};
var notHash = {};
var hasOwnProperty = Object.prototype.hasOwnProperty;
var slice = Array.prototype.slice;

var processes = [
    {
        re: /^(\s*)!(.*)$/,
        process: function (hash, m, g1, g2) {
            return ""; //g1 + "#" + g2;
        }
    },
    {
        re: /^\|\|(.+)$/,
        process: function (hash, m, g1) {
            var rule = "." + convertPath(g1);

            if (hasOwnProperty.call(hash, rule))
                return "";
            else {
                hash[rule] = true;
                return rule;
            }
        }
    },
    {
        re: /^\|([a-z0-9-]+):\/\/(.+)$/,
        process: function (hash, m, g1, g2) {
            var port;
            switch (g1) {
                case "https":
                    port = 443;
                    break;
                case "http":
                    port = 80;
                    break;
                default:
                    return g2;
            }
            var rule = convertPath(g2.replace(/(\/)|$/, ":" + port + "$1"));

            if (hasOwnProperty.call(hash, rule))
                return "";
            else {
                hash[rule] = true;
                return rule;
            }
        }
    },
    {
        re: /^\/\^([a-z0-9-]+\??):\\\/\\\/(\[\^\\\/\]\+)?([^\/]+)(?:(\\\/)(.*))?\/$/,
        process: function (hash, m, protocol, pre, main, slash, path) {
            var rule = (pre ? "." : "") + main.replace(/\\/g, "");
            switch (protocol) {
                case "https":
                    rule += ":443";
                    break;
                case "http":
                    rule += ":80";
                    break;
                default:
                    break;
            }
            if (slash)
                rule += "/" + path;

            if (hasOwnProperty.call(hash, rule))
                return "";
            else {
                hash[rule] = true;
                return rule;
            }
        }
    },
    {
        re: /^@@(.+)$/,
        process: function (hash, m, g1) {
            notList.push(convertRules(g1, notHash));
            return "";
        }
    },
    {
        re: /^.+$/,
        process: function (hash, m) {
            rules = [];

            var re = /^(?:([a-z0-9-]+):\/\/)?(\.?[a-z0-9-]+(?:\.[a-z0-9-]+)+\.?)(?:([\*\/])(.*))?$|.+/;
            var groups = re.exec(m);

            var key = groups[0];
            var protocol = groups[1];
            var domain = groups[2];
            var separator = groups[3];
            var path = groups[4];

            var rule = convertPath(":80/*" + key + "*");

            if (!hasOwnProperty.call(hash, rule)) {
                hash[rule] = true;
                rules.push(rule);
            }

            if (domain) {
                rule = domain;
                if (rule.charAt(0) != ".")
                    rule = "." + rule;
                switch (protocol) {
                    case "https":
                        rule += ":443";
                        break;
                    case "http":
                        rule += ":80";
                        break;
                    default:
                        break;
                }

                if (separator)
                    rule += convertPath((separator == "*" ? "/*" : "/") + path);

                if (!hasOwnProperty.call(hash, rule)) {
                    hash[rule] = true;
                    rules.push(rule);
                }
            }

            return rules.join("\n");
        }
    }
];

var notList = [];

var rules =
    "# Online rules generated at " + new Date().toString() + "\r\n" +
    "# Learn more about X-Wall\r\n" +
    "# https://github.com/vilic/x-wall\r\n\r\n" +
    ("$forward-string$\n" +
    text.replace(/.+/g, function (m) {
        return convertRules(m, hash);
    }).replace(/.+\n/, "").replace(/\s+$/, "")).replace(/(?:\s*\n\s*){2,}/g, "\n").replace(/\r?\n/g, "\r\n");

rules +=
    "\r\n\r\n" +
    "$donnot-forward-string$\r\n" +
    notList.join("\r\n").replace(/(?:\s*\n\s*){2,}/g, "\r\n");

function convertRules(rule, hash) {
    for (var i = 0; i < processes.length; i++) {
        var p = processes[i];
        if (p.re.test(rule)) {
            return rule.replace(p.re, function () {
                var args = slice.call(arguments);
                args.unshift(hash);
                return p.process.apply(p, args);
            });
        }
    }

    return rule;
}

function convertPath(rule) {
    return rule.replace(/\/(.+)$/, function (m, g1) {
        return "/" + g1.replace(/([\.\?\+\(\)\{\}\[\]\\])/g, "\\$1").replace(/\*/g, ".*");
    });
}

var fso = new ActiveXObject('Scripting.FileSystemObject');
if (fso.fileExists("for-x-wall")) {
    fileNames.push("rules", "rules-v2");
    forwardStrings.push("{+forward-override{$forward-type$ $server$ .}}", "{+forward-override{$forward-settings$}}");
    donnotForwardStrings.push("{+forward-override{forward .}}", "{+forward-override{$default-forward-settings$}}");
}

var file;
//file = fso.createTextFile('rules-src', true);
//file.write(text);
//file.close();
for (var i = 0; i < fileNames.length; i++) {
    file = fso.createTextFile(fileNames[i], true);
    file.write(rules.replace("$forward-string$", forwardStrings[i]).replace("$donnot-forward-string$", donnotForwardStrings[i]));
    file.close();
}

WScript.echo("done");
//WScript.sleep(30000);