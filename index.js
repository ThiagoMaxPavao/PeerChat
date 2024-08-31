var peer;
var connections = [];
var username = '';
var peersList = new Set();

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('message-input').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Evita o comportamento padrão do ENTER (quebra de linha)
            sendMessage();
        }
    });
});

function setUsername() {
    username = document.getElementById('username-input').value.trim();
    if (username) {
        peer = new Peer();

        peer.on('open', function(id) {
            document.getElementById('my-id').textContent = id;
            document.getElementById('peer-id-input').disabled = false;
            document.querySelector('button[onclick="connectToPeer()"]').disabled = false;
            document.getElementById('message-input').disabled = false;
            document.querySelector('button[onclick="sendMessage()"]').disabled = false;
        });

        peer.on('connection', function(connection) {
            handleNewConnection(connection);
        });

        // Desabilitar input de username e botões após o username ser definido
        document.getElementById('username-input').disabled = true;
        document.querySelector('button[onclick="setUsername()"]').disabled = true;
    } else {
        alert('Por favor, defina um username.');
    }
}

function connectToPeer() {
    var peerId = document.getElementById('peer-id-input').value;
    if (!peersList.has(peerId)) {
        var conn = peer.connect(peerId);
        conn.on('open', function() {
            handleNewConnection(conn);
        });

        conn.on('error', function(err) {
            console.error('Erro ao conectar ao peer:', err);
        });
    }
}

function handleNewConnection(connection) {
    if (!connections.find(item => item.conn.peer === connection.peer)) {
        // Armazena a nova conexão e inicializa com o username vazio
        connections.push({ conn: connection, username: '' });
        peersList.add(connection.peer);
        updateConnectionsTable();

        // Verifica se a conexão já está aberta
        if (connection.open) {
            // Se a conexão já está aberta, envia o username imediatamente
            connection.send({ type: 'username', username: username });
        } else {
            // Caso contrário, espera o evento 'open' para enviar o username
            connection.on('open', function() {
                connection.send({ type: 'username', username: username });
            });
        }

        // Configura o evento 'data' para lidar com mensagens recebidas
        connection.on('data', function(data) {
            handleData(connection, data);
        });

        connection.on('close', function() {
            console.log('Conexão fechada com peer:', connection.peer);
            removePeer(connection.peer);
        });

        // Informa todos os peers conhecidos sobre o novo peer
        notifyPeersOfNewConnection(connection.peer);
    }
}

function handleData(connection, data) {
    if (data.type === 'username') {
        updateUsername(connection.peer, data.username);
    } else if (data.type === 'new-peer') {
        if (!peersList.has(data.peerId)) {
            addNewPeer(data.peerId);
        }
    } else if (data.type === 'full-peer-list') {
        updatePeersList(data.peers);
    } else if (data.type === 'message') {
        displayMessage('<i>' + getUsername(connection.peer) + ':</i> ' + data.message);
    }
}

function sendMessage() {
    var message = document.getElementById('message-input').value;
    if (connections.length > 0) {
        connections.forEach(function(item) {
            if (item.conn.open) {
                item.conn.send({ type: 'message', message: message });
            }
        });
        displayMessage('<i>Você:</i> ' + message);
        document.getElementById('message-input').value = '';
    } else {
        alert('Não está conectado a nenhum peer!');
    }
}

function notifyPeersOfNewConnection(newPeerId) {
    peersList.add(newPeerId);
    connections.forEach(function(item) {
        if (item.conn.open && item.conn.peer !== newPeerId) {
            item.conn.send({ type: 'new-peer', peerId: newPeerId });
        }
    });
}

function addNewPeer(peerId) {
    if (peerId !== peer.id && !peersList.has(peerId)) {
        peersList.add(peerId);
        var conn = peer.connect(peerId);

        conn.on('open', function() {
            handleNewConnection(conn);
        });

        conn.on('error', function(err) {
            console.error('Erro ao conectar ao novo peer:', err);
        });
    }
}

function updatePeersList(peers) {
    let newPeersAdded = false;

    peers.forEach(peerId => {
        if (peerId !== peer.id && !peersList.has(peerId)) {
            peersList.add(peerId);
            addNewPeer(peerId);
            newPeersAdded = true;
        }
    });

    // Apenas propaga a lista se houver novos peers adicionados
    if (newPeersAdded) {
        propagatePeersList();
    }
}

function propagatePeersList() {
    const peerArray = Array.from(peersList);
    connections.forEach(function(item) {
        if (item.conn.open) {
            item.conn.send({ type: 'full-peer-list', peers: peerArray });
        }
    });
}

function updateUsername(peerId, newUsername) {
    var connection = connections.find(item => item.conn.peer === peerId);
    if (connection) {
        connection.username = newUsername;
        updateConnectionsTable();
    }
}

function getUsername(peerId) {
    var connection = connections.find(item => item.conn.peer === peerId);
    return connection ? connection.username : peerId;
}

function updateConnectionsTable() {
    var tbody = document.getElementById('connections-body');
    tbody.innerHTML = '';
    connections.forEach(function(item) {
        var row = document.createElement('tr');
        var peerIdCell = document.createElement('td');
        var usernameCell = document.createElement('td');

        peerIdCell.textContent = item.conn.peer;
        usernameCell.textContent = item.username || 'Desconhecido';

        row.appendChild(peerIdCell);
        row.appendChild(usernameCell);
        tbody.appendChild(row);
    });
}

function removePeer(peerId) {
    connections = connections.filter(item => item.conn.peer !== peerId);
    peersList.delete(peerId);
    updateConnectionsTable();
}

function displayMessage(message) {
    var messagesDiv = document.getElementById('messages');
    var newMessage = document.createElement('div');
    newMessage.innerHTML = message;
    messagesDiv.appendChild(newMessage);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
