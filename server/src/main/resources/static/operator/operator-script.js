const rtcConfiguration = {
    iceServers: [
        {urls: "stun:stun.services.mozilla.com"},
        {urls: "stun:stun.l.google.com:19302"}
    ]
};

let stompClient = null;
let peerConnection = null;

const offerOptions = {
    offerToReceiveAudio: false,
    offerToReceiveVideo: true
};

connect();

function connect() {
    let socket = new SockJS('/websocket-endpoint');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, async function (frame) {
        console.log('Connected: ' + frame);
        stompClient.subscribe('/receive/operator', processMessage);
    });
}

function getOrCreatePeerConnection() {
    if (peerConnection == null) {
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        peerConnection.addEventListener('icecandidate', onIceCandidate);
        peerConnection.addEventListener('track', onRemoteTrack);
    }

    return peerConnection;
}

function closePeerConnection() {
    peerConnection.close();
    peerConnection = null;
}

async function start() {
    peerConnection = getOrCreatePeerConnection();

    const offer = await peerConnection.createOffer(offerOptions);
    await peerConnection.setLocalDescription(offer);
    send('MEDIA', offer);
}

function stop() {
    peerConnection.close();
    peerConnection = null;
    send('STOP', '');
}

async function processMessage(data) {
    let m = JSON.parse(data.body);
    switch (m.type) {
        case "MEDIA": {
            const answer = JSON.parse(m.message);
            const desc = new RTCSessionDescription(answer);
            const peerConnection = getOrCreatePeerConnection();
            await peerConnection.setRemoteDescription(desc);
            break;
        }
        case "ICE": {
            const ice = JSON.parse(m.message);
            const candidate = new RTCIceCandidate(ice);
            const peerConnection = getOrCreatePeerConnection();
            await peerConnection.addIceCandidate(candidate);
            break;
        }
    }
}

function send(type, message) {
    stompClient.send("/robot", {}, JSON.stringify({
        type: type,
        message: JSON.stringify(message)
    }));
}

function onIceCandidate(event) {
    if (event.candidate == null) {
        console.log("ICE Candidate was null, done");
        return;
    }

    send("ICE", event.candidate);
}

function onRemoteTrack(event) {
    const $videoElement = $("#stream").get(0);
    const stream = event.streams[0];
    if ($videoElement.srcObject !== stream) {
        console.log('Incoming stream');
        $videoElement.srcObject = stream;
    }
}