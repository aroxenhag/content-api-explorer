    // Crappy way of supporting both ACE and Polopoly
    var servicePath = "ace" == window.location.pathname.split("/")[1] ? "ace" : "onecms";

    var baseUrl = window.location.protocol + "//" + window.location.host + "/" + servicePath;

    // OVERRIDE
    baseUrl = "http://localhost:8080/onecms";

    var cm = CodeMirror.fromTextArea($("#data").get(0), {name: "javascript", json: true, lineNumbers: true});

    var setIdType = function(idType) {
     $("input:radio[name=idType][value=" + idType + "]").prop('checked', true);
   };

   var getIdType = function() {
     return $("input:radio[name=idType]:checked").val();
   };

   var getContent = function(idType, contentId, variant) {
    setIdType(idType);
    $("#contentId").val(contentId).change();
    $("#variant").val(variant).change();
    $("#get").click();
  };

    // DEV SHORTCUT
    $(document).keydown(function(event) {
      var keyCode = (event.which ? event.which : event.keyCode);
      if ((keyCode == 10 || keyCode == 13) && event.ctrlKey) {

        var tokenElement = $("#token");
        var fetchContent = function() {
          tokenElement.off("change", fetchContent);
          getContent("contentid", "policy:1.116", "");
        };
        tokenElement.on("change", fetchContent);
        $("#authenticate").click();
      }
    });
    // END DEV SHORTCUT

    $("#contentId").keydown(function(event) {
      if (event.which == 13) {
        $("#get").click();
      }
    });

    var updateActionButtons = function() {
      $("#get").prop("disabled", !$("#contentId").val() || !$("#token").val());
      $("#put").prop("disabled", !$("#contentId").val() || !$("#token").val() || !$("#etag").val() || !cm.getDoc().getValue());
      $("#post").prop("disabled", !$("#token").val() || !cm.getDoc().getValue());
    };

    var updateAuthenticationButton = function() {
      $("#authenticate").prop("disabled", !$("#username").val() || !$("#password").val());
    };

    $("#username, #password").on("input", updateAuthenticationButton);

    $("#contentId").on("input", updateActionButtons).change(updateActionButtons);
    $("#token").change(updateActionButtons);
    $("#etag").change(updateActionButtons);
    cm.on("change", updateActionButtons);

    var RECENT_COOKIE_NAME = "content-api-explorer-recent";
    var getRecentContent = function(callback) {
      if (window.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get("recent", function(items) {
          console.log("items", items);
          console.log("items.recent", items.recent);
          console.log("$.isEmptyObject(items)", $.isEmptyObject(items));
          var recentContent = $.isEmptyObject(items) ? [] : items["recent"];
          callback(recentContent);
        });
      } else {
        var recentContentCookie = $.cookie(RECENT_COOKIE_NAME);
        var recentContent = recentContentCookie ? JSON.parse(recentContentCookie) : [];
        callback(recentContent);
      }
    };

    var storeRecentContent = function(recentContent) {
      if (window.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({"recent": recentContent});
      } else {
        $.cookie(RECENT_COOKIE_NAME, JSON.stringify(recentContent));
      }
    };

    var putRecent = function(idType, contentId, variant) {
      var newRecentId = {"type": idType, "id": contentId, "variant": variant};

      getRecentContent(function(recentContent) {
          // TODO: Ugly indexOf check. Didn't get either native or jQuery version to work
          var index = -1;
          var i = 0;
          $.each(recentContent, function() {
            if (this.id == contentId && (!this.variant || this.variant == variant)) {
              index = i;
            }
            i++;
          });

          if (index > -1) {
            recentContent.splice(index, 1);
          }

          recentContent.unshift(newRecentId);
          storeRecentContent(recentContent);
        });
    };

    var reloadRecent = function() {
      var recent = $("#recent");
      recent.empty();

      getRecentContent(function(recentContent) {
        $.each(recentContent, function() {
          var entry = this;
          recent.append("<li><a href='#' data-id='" + entry.id + "' data-type='" + entry.type + "' data-variant='" + entry.variant + "'>" + entry.id + (entry.variant ? " ("  + entry.variant + ")": "") + "</a></li>");
        });
        recent.find("a").click(function(e) {
          var link = $(this);
          getContent(link.data("type"), link.data("id"), link.data("variant"));
          e.preventDefault();
          return;
        });
        $("#clearRecent").prop("disabled", recentContent.length < 1);
        $("#recentContainer .empty-message").toggle(recentContent.length < 1);
      });
    };

    $("#clearRecent").click(function() {
      storeRecentContent([]);
      reloadRecent();
    });

    var showAlert = function(message, details) {
      var alertElement = $("#alert");
      alertElement.show().find(".message").html("<h4>" + message + "</h4>" + "<pre>" + JSON.stringify(details, null, 2) + "</pre>");
    };

    var hideAlert = function() {
      $("#alert").css("display", "none");
    };

    $("#authenticate").click(function() {
      var body = {
        username: $("#username").val(),
        password: $("#password").val()
      };
      $.ajax({
        type: 'POST',
        url: baseUrl + "/security/token",
        data: JSON.stringify(body),
        headers: {
          "Content-Type":"application/json; charset=utf-8"
        }
      }).success(function(data) {
        $("#token").val(data.token).change();
      }).fail(function(data) {
        showAlert("Authentication failed", data.responseJSON);
      });
    });

    var updateDownloadUrl = function(id, url, data) {
      $("#getUrl").val(url).attr("title", url);
      var anchor = $("#download");
      var windowUrl = window.URL || window.webkitURL;
      var blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
      var url = windowUrl.createObjectURL(blob);
      anchor.prop('href', url);
      anchor.prop('download', id + ".json");
      anchor.removeClass("disabled");
    };

    var updateFromResponse = function(data, response) {
      $("#etag").val(response.getResponseHeader("ETag")).change();

      cm.getDoc().setValue(JSON.stringify(data, null, 2));
      var i = 0;
      var aspects = $("#aspects");
      aspects.empty();
      for (var aspect in data.aspects) {
        aspects.append("<div><input data-aspect-name='" + aspect + "' checked id='aspect" + i + "' type='checkbox'><label for='aspect" + i + "'>" + aspect + "</label></div>");
        i++;
      }

      var updateAspects = function() {
        var tmpData = JSON.parse(JSON.stringify(data));
        aspects.find("input").each(function() {
          if (!$(this).prop("checked")) {
            delete tmpData.aspects[$(this).data("aspect-name")];
          }
        });
        cm.getDoc().setValue(JSON.stringify(tmpData, null, 2));
      }

      aspects.find("input").change(updateAspects);

      $("#aspectsContainer").show();

      $("#selectAllAspects").click(function() {
        $("#aspects input").prop("checked", true);
        updateAspects();
      });
      $("#deselectAllAspects").click(function() {
        $("#aspects input").prop("checked", false);
        updateAspects();
      });
      $("#data-container").removeClass("collapsed");
      $("#diff-container").hide();
    };

    var loadHistory = function(contentId) {
      $("#historyContainer").hide();
      $("#compare").off("click");
      var historyUrl = baseUrl + "/content/contentid/" + contentId + "/history";
      var token = $("#token").val();
      $.getJSON({
        type: 'GET',
        url: historyUrl,
        headers: {
          "X-Auth-Token": token
        }
      }).success(function(data, status, response) {

        var i = 0;
        var history = $("#history");
        history.empty();
        $.each(data.versions.reverse(), function() {
          var version = this;
          var date = new Date(version.creationTime);
          history.append("<li><input data-contentid='" + version.version + "' id='version" + i + "' type='checkbox'><label for='version" + i + "'>" + "<span>" + date + "</span><br>" + "<pre>" + JSON.stringify(version, null, 2) + "</pre></label></li>");
          i++;
        });

        history.find("input").click(function(event) {
          if (history.find("input:checked").size() > 2) {
            alert("You can only select two versions to compare.");
            event.preventDefault();
            return;
          }
        });

        history.find("input").change(function(event) {
          $("#compare").prop("disabled", history.find("input:checked").size() != 2);
        });

        $("#historyContainer").show();

        $("#compare").click(function() {
          var checkedInputs = history.find("input:checked");
          var contentId1 = checkedInputs.first().data("contentid");
          var contentId2 = checkedInputs.last().data("contentid");

          var url1 = baseUrl + "/content/contentid/" + contentId1;
          var url2 = baseUrl + "/content/contentid/" + contentId2;

          $.getJSON({
            type: 'GET',
            url: url1,
            headers: {
              "X-Auth-Token": token
            }
          }).success(function(data, status, response) {
            var content1 = data;

            $.getJSON({
              type: 'GET',
              url: url2,
              headers: {
                "X-Auth-Token": token
              }
            }).success(function(data, status, response) {
              var content2 = data;

              var diffpatcher = jsondiffpatch.create({
                objectHash: function(obj) {
                  return obj.name;
                },
                arrays: {
                  detectMove: true,
                  includeValueOnMove: false
                },
                textDiff: {
                  minLength: 20
                }
              });
              var delta = diffpatcher.diff(content2, content1);
              $("#diff").html(jsondiffpatch.formatters.html.format(delta, content2));
              $("#data-container").addClass("collapsed");
              $(".data-container-overlay").click(function() {
                $("#data-container").removeClass("collapsed");
              });
              $("#diff-container").show();
            }).fail(function(data, status, response) {
              showAlert("Get failed", data.responseJSON);
            });

          }).fail(function(data, status, response) {
            showAlert("Get failed", data.responseJSON);
          });


        });

      }).fail(function(data, status, response) {
        showAlert("Get history failed", data.responseJSON);
      });
    };

    $("#get").click(function() {
      hideAlert();
      var token = $("#token").val();
      if (!token) {
        alert("Must authenticate first.");
        return;
      }
      var contentId = $("#contentId").val();
      if (!contentId) {
        alert("Must specify content id.");
        return;
      }
      var idType = getIdType();
      var variant = $("#variant").val();
      var url = baseUrl + "/content/" + idType + "/" + contentId;
      if (variant) {
        url += "?variant=" + variant;
      }
      $.getJSON({
        type: 'GET',
        url: url,
        headers: {
          "X-Auth-Token": token
        }
      }).success(function(data, status, response) {
        updateDownloadUrl(contentId, url, data);
        updateFromResponse(data, response);

        putRecent(idType, contentId, variant);
        reloadRecent();

        loadHistory(data.id);
      }).fail(function(data, status, response) {
        showAlert("Get failed", data.responseJSON);
      });
    });

    $("#put").click(function() {
      hideAlert();
      var token = $("#token").val();
      if (!token) {
        alert("Must authenticate first.");
        return;
      }
      var contentId = $("#contentId").val();
      if (!contentId) {
        alert("Must specify content id.");
        return;
      }
      var idType = getIdType();
      var url = baseUrl + "/content/" + idType + "/" + contentId;
      $.ajax({
        type: 'PUT',
        url: url,
        data: cm.getDoc().getValue(),
        headers: {
          "X-Auth-Token": token,
          "Content-Type":"application/json; charset=utf-8",
          "If-Match":$("#etag").val()
        }
      }).success(function(data, status, response) {
        updateDownloadUrl(contentId, url, data);
        updateFromResponse(data, response);

        putRecent(idType, contentId);
        reloadRecent();

        loadHistory(data.id);
      }).fail(function(data, status, response) {
        showAlert("Update failed", data.responseJSON);
      });
    });

    $("#post").click(function() {
      hideAlert();
      var token = $("#token").val();
      if (!token) {
        alert("Must authenticate first.");
        return;
      }
      $.ajax({
        type: 'POST',
        url: baseUrl + "/content",
        data: cm.getDoc().getValue(),
        headers: {
          "X-Auth-Token": token,
          "Content-Type":"application/json; charset=utf-8"
        }
      }).success(function(data, status, response) {
        var location = response.getResponseHeader("Location");
        var contentId = location.substring(location.lastIndexOf("/") + 1, location.lastIndexOf(":"));
        var url = baseUrl + location.substring(0, location.lastIndexOf(":"));
        updateDownloadUrl(contentId, url, data);
        updateFromResponse(data, response);
        $("#contentId").val(data.id);

        putRecent("contentid", data.id);
        reloadRecent();

        loadHistory(data.id);
      }).fail(function(data, status, response) {
        showAlert("Creation failed", data.responseJSON);
      });
    });

    updateAuthenticationButton();
    updateActionButtons();
    reloadRecent();

    $(document).foundation();
    console.log("loaded...");