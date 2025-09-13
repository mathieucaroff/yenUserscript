// @ts-check

// ==UserScript==
// @name         YenToEuroAutoConverter
// @namespace    http://tampermonkey.net/
// @version      2025-08-27
// @description  Convert Yen values to Euro
// @author       You
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=agoda.com
// @grant        none
// ==/UserScript==

var yenToEuroConversionRate = 0.0058;

(function () {
  "use strict";

  function findAndConvert() {
    visitAllTextNodes(document.body, (textNode) => {
      var success = false;
      if ((textNode.nodeValue ?? "").includes("¥")) {
        if (textNode.parentElement?.tagName === "SCRIPT") return;
        console.log(
          "Found text node:",
          textNode.nodeValue,
          textNode.parentElement
        );
        if (markNode(textNode)) return;
        walkSidewayAndUpUntil("right", textNode, (nodeList) => {
          var text = nodeList.map((node) => node.textContent).join("");
          var textMatch = text.match(/¥[\s\u202F\u00A0]*[^\s\u202F\u00A0]/);
          var yenMatch = text.match(/¥[\s\u202F\u00A0]*([\d\s,]+(\.\d+)?)/);
          if (yenMatch) {
            var yenValue = Number(yenMatch[1].replace(/[\s,]/g, ""));
            var euroValue = yenValue * yenToEuroConversionRate;
            var euroString = euroValue.toLocaleString("de-DE", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 2,
            });
            textNode.nodeValue = `(${euroString}) ${textNode.nodeValue}`;
            success = true;
          }
          if (success) {
            console.log("SUCCESS:", textNode.nodeValue);
          } else if (textMatch) {
            console.log("STOP (textMatch):", text);
          }
          return {
            keepGoing: !textMatch && !yenMatch,
          };
        });
        if (success) return;
        walkSidewayAndUpUntil("left", textNode, (nodeList) => {
          var text = nodeList.map((node) => node.textContent).join("");
          var textMatch = text.match(/[^\s\u202F\u00A0][\s\u202F\u00A0]*¥/);
          var yenMatch = text.match(/([\d\s,]+(\.\d+)?)[\s\u202F\u00A0]*¥/);
          if (yenMatch) {
            var yenValue = Number(yenMatch[1].replace(/[\s,]/g, ""));
            var euroValue = yenValue * yenToEuroConversionRate;
            var euroString = euroValue.toLocaleString("de-DE", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 2,
            });
            textNode.nodeValue = `${textNode.nodeValue} (${euroString})`;
            success = true;
          }
          if (success) {
            console.log("SUCCESS:", textNode.nodeValue);
          } else if (textMatch) {
            console.log("STOP (textMatch):", text);
          }
          return {
            keepGoing: !textMatch && !yenMatch,
          };
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
   * @param {'left' | 'right'} direction
   * @param {Node} startNode
   * @param {(nodeList: Node[]) => { keepGoing: boolean }} callback
   */
  function walkSidewayAndUpUntil(direction, startNode, callback) {
    var nodeList = [startNode];

    var k = 0;
    while (callback(nodeList).keepGoing && ++k < 1000) {
      let node = direction === "left" ? nodeList[0] : nodeList.slice(-1)[0];
      let sibling =
        direction === "left" ? node.previousSibling : node.nextSibling;
      if (sibling) {
        if (direction === "left") {
          nodeList.unshift(sibling);
        } else {
          nodeList.push(sibling);
        }
      } else {
        if (node.parentNode) {
          nodeList = [node.parentNode];
        } else {
          console.log(
            "STOP: walkSidewayAndUpUntil: Reached the top of the DOM tree"
          );
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

  // new MutationObserver(() => {
  //   findAndConvert();
  // }).observe(document.documentElement, {
  //   childList: true,
  //   attributes: true,
  //   subtree: true,
  // });

  document.documentElement.addEventListener(
    "click",
    () => {
      findAndConvert();
    },
    true
  );
})();
