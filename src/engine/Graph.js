// ========================================
// Graph.js — Core Graph Data Structure
// ========================================

import { generateId } from '../utils/helpers.js';

export class Graph {
  constructor() {
    this.nodes = new Map();
    this.connections = new Map();
    this.groups = new Map();
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    return node;
  }

  removeNode(nodeId) {
    // Remove all connections to/from this node
    const connectionsToRemove = [];
    this.connections.forEach((conn, id) => {
      if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
        connectionsToRemove.push(id);
      }
    });
    connectionsToRemove.forEach(id => this.connections.delete(id));
    this.nodes.delete(nodeId);
    return connectionsToRemove;
  }

  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  addConnection(connection) {
    // Prevent duplicate connections
    for (const [id, conn] of this.connections) {
      if (conn.fromNodeId === connection.fromNodeId &&
          conn.fromPortIndex === connection.fromPortIndex &&
          conn.toNodeId === connection.toNodeId &&
          conn.toPortIndex === connection.toPortIndex) {
        return null;
      }
    }
    // Prevent self-connections
    if (connection.fromNodeId === connection.toNodeId) return null;
    
    this.connections.set(connection.id, connection);
    return connection;
  }

  removeConnection(connId) {
    this.connections.delete(connId);
  }

  getConnectionsForNode(nodeId) {
    const result = [];
    this.connections.forEach(conn => {
      if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
        result.push(conn);
      }
    });
    return result;
  }

  clear() {
    this.nodes.clear();
    this.connections.clear();
    this.groups.clear();
  }

  serialize() {
    const nodes = [];
    this.nodes.forEach(node => nodes.push(node.serialize()));
    
    const connections = [];
    this.connections.forEach(conn => connections.push({ ...conn }));
    
    return { nodes, connections };
  }

  deserialize(data, NodeClass) {
    this.clear();
    if (data.nodes && NodeClass) {
      data.nodes.forEach(nodeData => {
        const node = NodeClass.fromData(nodeData);
        this.nodes.set(node.id, node);
      });
    }
    if (data.connections) {
      data.connections.forEach(conn => {
        this.connections.set(conn.id, conn);
      });
    }
  }

  getNodeCount() {
    return this.nodes.size;
  }

  getConnectionCount() {
    return this.connections.size;
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  getAllConnections() {
    return Array.from(this.connections.values());
  }

  getBounds() {
    if (this.nodes.size === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
}
