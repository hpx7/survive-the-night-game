import { Tree } from "@/shared/entities/tree";
import { Entities } from "../shared/entities";
import { EntityManager } from "./entity-manager";
import { Wall } from "@/shared/entities/wall";

const MAPS = {
  testing: {
    entities: [
      {
        type: Entities.TREE,
        position: { x: 40, y: 40 },
      },
      {
        type: Entities.TREE,
        position: { x: 60, y: 60 },
      },
      {
        type: Entities.TREE,
        position: { x: 80, y: 60 },
      },
      {
        type: Entities.TREE,
        position: { x: 60, y: 100 },
      },
      {
        type: Entities.WALL,
        position: { x: 100, y: 100 },
      },
      {
        type: Entities.WALL,
        position: { x: 40, y: 50 },
      },
    ],
    map: [
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    ],
  },
} as const;

type MapId = keyof typeof MAPS;

export class MapManager {
  // private map: number[][] = [];
  private entityManager: EntityManager;

  constructor(entityManager: EntityManager) {
    this.entityManager = entityManager;
  }

  loadMap(mapId: MapId) {
    const mapToLoad = MAPS[mapId];
    this.entityManager.clear();

    for (const entity of mapToLoad.entities) {
      if (entity.type === Entities.TREE) {
        const tree = new Tree(this.entityManager);
        tree.setPosition(entity.position);
        this.entityManager.addEntity(tree);
      } else if (entity.type === Entities.WALL) {
        const wall = new Wall(this.entityManager);
        wall.setPosition(entity.position);
        this.entityManager.addEntity(wall);
      }
    }
  }
}