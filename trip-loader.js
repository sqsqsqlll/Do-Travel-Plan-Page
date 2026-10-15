/* 行程数据面板：导入（保存在当前浏览器）/ 导出当前行程 / 清除导入；数据来源标识 */
(function () {
  "use strict";
  var KEY = "travel-plan:local-trip-data";

  function storage() {
    try { return window.localStorage; } catch (error) { return null; }
  }

  function validate(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("文件内容不是 JSON 对象");
    if (data.schemaVersion !== "2.0-lite") throw new Error("schemaVersion 必须是 2.0-lite，请使用账本「🗺 行程页」导出的文件");
    if (!data.config || data.config.schemaVersion !== "1.0.0" || !data.config.modules) throw new Error("缺少 config 或模块开关");
    if (!data.metadata || !data.metadata.tripId || !data.metadata.title) throw new Error("缺少 metadata.tripId / title");
    if (!data.trip || !Array.isArray(data.days)) throw new Error("缺少 trip 或 days");
    if (data.trip.status === "uninitialized") throw new Error("这是空白模板，没有行程内容");
    if (!data.map) throw new Error("缺少 map 字段");
    return data;
  }

  function readLocalTrip() {
    var store = storage();
    if (!store) return null;
    try {
      var raw = store.getItem(KEY);
      return raw ? validate(JSON.parse(raw)) : null;
    } catch (error) {
      console.warn("Local trip data ignored", error);
      return null;
    }
  }

  function showError(message) {
    var el = document.getElementById("trip-loader-error");
    if (!el) { window.alert(message); return; }
    el.textContent = message;
    el.hidden = false;
  }

  function importFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = validate(JSON.parse(String(reader.result).replace(/^﻿/, "")));
        var store = storage();
        if (!store) throw new Error("当前浏览器禁止本地存储，无法保存导入的行程");
        store.setItem(KEY, JSON.stringify(data));
        window.location.reload();
      } catch (error) {
        showError("无法导入：" + (error && error.message ? error.message : "文件格式不正确"));
      }
    };
    reader.readAsText(file);
  }

  function exportCurrent(data) {
    if (!data) return;
    var blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "trip-data.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  var SOURCE_TEXT = {
    local: ["本机导入", "is-local", "正在显示你在这台设备上导入的行程。可以导出备份、发给同行人，或清除后回到默认内容。"],
    demo: ["示例行程", "is-demo", "这是一趟示例行程，用来展示航班、路线地图、每日行程、门票、租车自驾、行前准备和记账等功能。导入你自己的行程即可替换。"],
    repository: ["已发布", "is-repo", "正在显示网站发布的行程（仓库中的 trip-data.json），所有人打开网址看到的都是这一份。也可以导入其他行程在本机查看。"]
  };

  function setup(data) {
    var section = document.getElementById("trip-loader");
    if (!section) return;
    var source = window.TRIP_DATA_SOURCE || "repository";
    var text = SOURCE_TEXT[source] || SOURCE_TEXT.repository;
    var badge = document.getElementById("trip-loader-badge");
    badge.textContent = text[0];
    badge.className = "trip-loader__badge " + text[1];
    document.getElementById("trip-loader-status").textContent = text[2];
    document.getElementById("trip-loader-clear").hidden = source !== "local";
    section.hidden = false;
    var input = document.getElementById("trip-loader-file");
    input.onchange = function () { importFile(input.files && input.files[0]); input.value = ""; };
    document.getElementById("trip-loader-export").onclick = function () { exportCurrent(data); };
    document.getElementById("trip-loader-clear").onclick = function () {
      if (!window.confirm("清除本机导入的行程，回到网站默认内容？")) return;
      var store = storage();
      if (store) store.removeItem(KEY);
      window.location.reload();
    };
  }

  window.TripLoader = { readLocalTrip: readLocalTrip, validate: validate, storageKey: KEY };
  document.addEventListener("travel-data-ready", function (event) { setup(event.detail); });
})();
