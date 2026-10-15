/* 行程导入：在浏览器里载入 旅游AA账本 导出的 trip-data.json（只保存在当前浏览器） */
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

  function setup(data) {
    var section = document.getElementById("trip-loader");
    if (!section) return;
    var isLocal = window.TRIP_DATA_SOURCE === "local";
    var isEmpty = !data || !data.trip || data.trip.status === "uninitialized";
    section.hidden = !(isLocal || isEmpty);
    document.getElementById("trip-loader-empty").hidden = !isEmpty;
    document.getElementById("trip-loader-bar").hidden = !isLocal;
    ["trip-loader-file", "trip-loader-file-replace"].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.onchange = function () { importFile(input.files && input.files[0]); input.value = ""; };
    });
    var clear = document.getElementById("trip-loader-clear");
    if (clear) clear.onclick = function () {
      if (!window.confirm("清除本机导入的行程，恢复显示仓库中的 trip-data.json？")) return;
      var store = storage();
      if (store) store.removeItem(KEY);
      window.location.reload();
    };
  }

  window.TripLoader = { readLocalTrip: readLocalTrip, validate: validate, storageKey: KEY };
  document.addEventListener("travel-data-ready", function (event) { setup(event.detail); });
})();
