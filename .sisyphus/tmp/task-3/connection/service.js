"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionService = void 0;
class ConnectionService {
    constructor(repository) {
        this.repository = repository;
    }
    createConnection(input) {
        return this.repository.create(input);
    }
    listConnections() {
        return this.repository.list();
    }
}
exports.ConnectionService = ConnectionService;
