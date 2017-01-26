var remote = require('electron').remote;
var basepath = remote.app.getAppPath();
var dialog = remote.require('electron').dialog;
var path = require('path');
var fs = require('fs');

function fileSelcted() {
    document.getElementById('video-tagging-container').style.display = "none";
    document.getElementById('exportCNTK').style.display = "none";
    document.getElementById('openFile').style.display = "none";
    document.getElementById('saveFile').style.display = "none";

    dialog.showOpenDialog(function (fileName) {
        console.log(fileName);
        var config;

        document.getElementById('load-message').style.display = "none";
        document.getElementById('load-form-container').style.display = "block";

        $('#inputtags').tagsinput('removeAll');

        try{
        config = require(`${fileName}.json`);
        document.getElementById('MultiRegions').checked = config.multiRegions;
        //restore tags
        document.getElementById('inputtags').value = config.inputTags;
        config.inputTags.split(",").forEach(function(tag) {
            $("#inputtags").tagsinput('add',tag);
        });

        }
        catch (e){
        console.log(`Error loading save file ${e.message}`);
        }
        document.getElementById('loadButton').addEventListener('click', function (e) {

        var videotagging = document.getElementById('video-tagging');

        videotagging.framerate = document.getElementById('framerate').value;

        videotagging.regiontype = document.getElementById('regiontype').value;
        videotagging.multiregions = document.getElementById('MultiRegions').checked ? "1":"0";
        videotagging.regionsize = document.getElementById('regionsize').value;
        videotagging.inputtagsarray = document.getElementById('inputtags').value.split(',');

        videotagging.video.currentTime = 0;

        if(config) videotagging.inputframes = config.frames;
        else videotagging.inputframes = {};

        document.getElementById('load-form-container').style.display = "none";
        document.getElementById('video-tagging-container').style.display = "block";
        document.getElementById('openFile').style.display = "inline";
        document.getElementById('saveFile').style.display = "inline";
        document.getElementById('exportCNTK').style.display = "inline";

        videotagging.src = fileName;//load


    });
    });

}

function save() {
    var videotagging = document.getElementById('video-tagging');
    var saveObject = {
        "frames" : videotagging.frames,
        "inputTags": document.getElementById('inputtags').value,
        "multiRegions": document.getElementById('MultiRegions').checked
    }

    console.log(frames);
    fs.writeFileSync(`${videotagging.src}.json`, JSON.stringify(saveObject));

}

function exportCNTK() {

    $("<div class=\"loader\"></div>").appendTo($("#video-tagging-container").css("position", "relative"));

    var videotagging = document.getElementById('video-tagging');

    //make sure paths exist
    if (!fs.existsSync(`${basepath}/cntk`)) fs.mkdirSync(`${basepath}/cntk`);
    var framesPath = `${basepath}/cntk/${path.basename(videotagging.src[0], path.extname(videotagging.src[0]))}_frames`;

    if (!fs.existsSync(framesPath)) fs.mkdirSync(framesPath);
    if (!fs.existsSync(`${framesPath}/positive`)) fs.mkdirSync(`${framesPath}/positive`);
    if (!fs.existsSync(`${framesPath}/negative`)) fs.mkdirSync(`${framesPath}/negative`);

    //init canvas buffer
    var frameCanvas = document.createElement("canvas");
    frameCanvas.width = videotagging.video.videoWidth;
    frameCanvas.height = videotagging.video.videoHeight;
    var canvasContext = frameCanvas.getContext("2d");

    // start exporting frames using the timeupdate eventListener
    videotagging.video.addEventListener("timeupdate", saveFrames);
    videotagging.video.currentTime = 0;
    videotagging.playingCallback();

    function saveFrames(){

    //if last frame removeEventListener and loader
    if (videotagging.video.currentTime >= videotagging.video.duration){
        videotagging.video.removeEventListener("timeupdate", saveFrames);
        $(".loader").remove();
    }

    var frameId = videotagging.frameText.innerText;

    //set default writepath to the negative folder
    var writePath = `${framesPath}/negative/${path.basename(videotagging.src[0], path.extname(videotagging.src[0]))}_frame_${frameId}.jpg`;

    //If frame contains tags generate the metadata and save it in the positive directory
    if (videotagging.frames.hasOwnProperty(frameId)){
        videotagging.frames[frameId].map(function(tag){
                if (!tag.tags[tag.tags.length-1]) {
                console.log(`frame ${frameId} region ${tag.name} has no label`);
                return;
                }
                writePath = `${framesPath}/positive/${path.basename(videotagging.src[0], path.extname(videotagging.src[0]))}_frame_${frameId}.jpg`;
                var stanW = videotagging.video.videoWidth/tag.width;
                var stanH = videotagging.video.videoHeight/tag.height;
                fs.appendFile(writePath.replace('.jpg', '.bboxes.labels.tsv'), `${tag.tags[tag.tags.length-1]}\n`, function (err) {});
                fs.appendFile(writePath.replace('.jpg', '.bboxes.tsv'), `${parseInt(tag.x1 * stanW)}\t${parseInt(tag.y1 * stanH)}\t${parseInt(tag.x2 * stanW)}\t${parseInt(tag.y2 * stanH)}\n`, function (err) {});
        });
    }

    //draw the frame to the canvas
    canvasContext.drawImage(videotagging.video, 0, 0);
    var data = frameCanvas.toDataURL('image/jpeg').replace(/^data:image\/\w+;base64,/, ""); // strip off the data: url prefix to get just the base64-encoded bytes http://stackoverflow.com/questions/5867534/how-to-save-canvas-data-to-file
    var buf = new Buffer(data, 'base64');

    //write canvas to file and change frame
    console.log('saving file', writePath);
    fs.writeFileSync(writePath, buf);
    videotagging.stepFwdClicked();

    }
}

function trackSelectedRegion(){
    var videotagging = document.getElementById('video-tagging');

    //init canvas buffer
    var frameCanvas = document.createElement("canvas");
    frameCanvas.width = videotagging.video.videoWidth;
    frameCanvas.height = videotagging.video.videoHeight;
    var canvasContext = frameCanvas.getContext("2d");


    var w = parseInt($('.regionCanvasSelected')[0].style.width);
    var h = parseInt($('.regionCanvasSelected')[0].style.height);
    var y = parseInt($('.regionCanvasSelected')[0].style.top);
    var x = parseInt($('.regionCanvasSelected')[0].style.left);

    var stanW = frameCanvas.width/videotagging.video.offsetWidth;
    var stanH = frameCanvas.height/videotagging.video.offsetHeight;

    var cstracker = new regiontrackr.camshift.Tracker({whitebalancing : false,calcAngles:false});
    cstracker.initTracker(frameCanvas, new regiontrackr.camshift.Rectangle(parseInt(x * stanW),parseInt(y * stanH),parseInt((x+w)*stanW),parseInt((y+h)*stanH)));
    //init event listner and increment frame here
    var frameId = videotagging.frameText.innerText;
    videotagging.video.addEventListener("timeupdate", tagRemainingFrames);
    videotagging.stepFwdClicked();

    function tagRemainingFrames(){

    //if last frame removeEventListener
    if (videotagging.video.currentTime >= videotagging.video.duration)
    {
        videotagging.video.removeEventListener("timeupdate", tagRemainingFrames);
        videotagging.video.currentTime = parseInt(frameId);
        videotagging.playingCallback();
    }

    //apply camshift here
    canvasContext.drawImage(videotagging.video, 0, 0);
    cstracker.track(frameCanvas);
    var trackedObject = cstracker.getTrackObj();
    console.log(trackedObject);
    //break if picture disapears
    if (trackedObject.width == 0 || trackedObject.height == 0 ){
        videotagging.video.removeEventListener("timeupdate", tagRemainingFrames);
        videotagging.video.currentTime = parseInt(frameId);
        videotagging.playingCallback();
    }
    else {
    stanW = videotagging.video.offsetWidth / frameCanvas.width;
    stanH = videotagging.video.offsetHeight /frameCanvas.height;

    videotagging.createRegion( trackedObject.x * stanW, trackedObject.y * stanH, (trackedObject.width + trackedObject.x) * stanW , (trackedObject.height + trackedObject.y)*stanH);
    videotagging.stepFwdClicked();

    }
        console.log(trackedObject);
    }
}