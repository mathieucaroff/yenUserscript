// @ts-check

// ==UserScript==
// @name         YenToEuroAutoConverter
// @namespace    http://tampermonkey.net/
// @version      2025-08-27
// @description  Convert Yen values to Euro
// @author       Mathieu CAROFF
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=agoda.com
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const defaultYenToEuroConversionRate = 0.00577;
  var yenToEuroConversionRate = 0;

  function findAndConvert() {
    if (!yenToEuroConversionRate) return;

    visitAllTextNodes(document.body, (textNode) => {
      if ((textNode.nodeValue ?? "").includes("¥")) {
        if (textNode.parentElement?.tagName === "SCRIPT") return;
        if (markNode(textNode)) return;
        walkSidewayAndUpUntil(textNode, {
          right: (nodeList) => {
            var text = nodeList.map((node) => node.textContent).join("");
            var textMatch = text.match(/¥[\s\u202F\u00A0]*[^\s\u202F\u00A0]/);
            var yenMatch = text.match(/¥[\s\u202F\u00A0]*(\d[\d\s,]*(\.\d+)?)/);
            if (yenMatch) {
              var yenValue = Number(yenMatch[1].replace(/[\s,]/g, ""));
              var euroValue = yenValue * yenToEuroConversionRate;
              var euroString = euroValue.toLocaleString("de-DE", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 2,
              });
              textNode.nodeValue = `(${euroString}) ${textNode.nodeValue}`;
            }
            return {
              found: !!yenMatch,
              keepGoing: !textMatch && !yenMatch,
            };
          },
          left: (nodeList) => {
            var text = nodeList.map((node) => node.textContent).join("");
            var textMatch = text.match(/[^\s\u202F\u00A0][\s\u202F\u00A0]*¥/);
            var yenMatch = text.match(/(\d[\d\s,]*(\.\d+)?)[\s\u202F\u00A0]*¥/);
            if (yenMatch) {
              var yenValue = Number(yenMatch[1].replace(/[\s,]/g, ""));
              var euroValue = yenValue * yenToEuroConversionRate;
              var euroString = euroValue.toLocaleString("de-DE", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 2,
              });
              textNode.nodeValue = `${textNode.nodeValue} (${euroString})`;
            }
            return {
              found: !!yenMatch,
              keepGoing: !textMatch && !yenMatch,
            };
          },
        });
      }
    });
  }

  /**
   * @param {Node} container
   * @param {(textNode: Text) => void} callback
   */
  function visitAllTextNodes(container, callback) {
    /** @param {Node} node */
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        callback(/** @type {Text} */ (node));
      } else {
        for (let child of node.childNodes) {
          walk(child);
        }
      }
    }
    walk(container);
  }

  /**
   * @param {Node} startNode
   * @param {{
   *   left: (nodeList: Node[]) => { found: boolean, keepGoing: boolean },
   *   right: (nodeList: Node[]) => { found: boolean, keepGoing: boolean }
   * }} callbackObject
   */
  function walkSidewayAndUpUntil(startNode, callbackObject) {
    var leftKeepGoing = true;
    var rightKeepGoing = true;
    var leftWait = false;
    var rightWait = false;
    var leftNodeList = [startNode];
    var rightNodeList = [startNode];

    var centralNode = startNode;

    for (var k = 0; (leftKeepGoing || rightKeepGoing) && k < 1000; k++) {
      // left
      if (leftKeepGoing && !leftWait) {
        var leftNode = leftNodeList[0];
        if (leftNode.previousSibling) {
          leftNodeList.unshift(leftNode.previousSibling);
          let { found, keepGoing } = callbackObject.left(leftNodeList);
          if (found) {
            break;
          }
          if (!keepGoing) {
            leftKeepGoing = false;
          }
        } else {
          leftWait = true;
        }
      }
      // right
      if (rightKeepGoing && !rightWait) {
        var rightNode = rightNodeList[rightNodeList.length - 1];
        if (rightNode.nextSibling) {
          rightNodeList.push(rightNode.nextSibling);
          let { found, keepGoing } = callbackObject.right(rightNodeList);
          if (found) {
            break;
          }
          if (!keepGoing) {
            rightKeepGoing = false;
          }
        } else {
          rightWait = true;
        }
      }
      // go up if both side are waiting for it
      if (leftWait && rightWait) {
        // go up
        if (centralNode.parentElement) {
          centralNode = centralNode.parentElement;
          leftWait = false;
          rightWait = false;
          leftNodeList = [centralNode];
          rightNodeList = [centralNode];
        } else {
          console.log("STOP (can't go up because no parentElement)");
          break;
        }
      }
    }
  }

  /**
   * @param {Node} node
   */
  function markNode(node) {
    if (node.parentElement?.getAttribute("data-yen-to-euro-converted")) {
      return true;
    }
    node.parentElement?.setAttribute("data-yen-to-euro-converted", "true");
    return false;
  }

  async function fetchConversionRate() {
    try {
      var yenUserscript = JSON.parse(
        localStorage.getItem("yenUserscript") || "{}"
      );
      var today = new Date().toISOString().split("T")[0];
      if (!yenUserscript.rate || yenUserscript.day !== today) {
        var r = await fetch("https://open.exchangerate-api.com/v6/latest/JPY");
        var data = await r.json();
        yenUserscript.rate = data.rates.EUR;
        yenUserscript.day = today;
        localStorage.setItem("yenUserscript", JSON.stringify(yenUserscript));
      }
      yenToEuroConversionRate = yenUserscript.rate;
    } catch (error) {
      console.log(error);
      yenToEuroConversionRate = defaultYenToEuroConversionRate;
    }
  }

  fetchConversionRate().then(findAndConvert);

  document.documentElement.addEventListener("click", findAndConvert, true);

  new MutationObserver(findAndConvert).observe(document.documentElement, {
    childList: true,
    attributes: true,
    subtree: true,
  });
})();
