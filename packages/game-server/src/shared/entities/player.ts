import { Entities, Entity, RawEntity } from "../entities";
import { Input } from "../../server";
import { EntityManager } from "../../managers/entity-manager";
import { Bullet } from "./bullet";
import { Tree } from "./tree";
import { Wall } from "./wall";
import {
  Collidable,
  Damageable,
  Interactable,
  Hitbox,
  InteractableKey,
  Consumable,
  ConsumableKey,
} from "../traits";
import { Movable, Positionable, Updatable } from "../traits";
import { distance, normalizeVector, Vector2 } from "../physics";
import { Direction } from "../direction";
import { InventoryItem, ItemType } from "../inventory";
import { Weapon } from "./weapon";
import { recipes, RecipeType } from "../recipes";
import { DEBUG } from "../../index";
import { Cooldown } from "./util/cooldown";
import { Bandage } from "./items/bandage";
import { Sound, SOUND_TYPES } from "./sound";

export class Player
  extends Entity
  implements Movable, Positionable, Updatable, Collidable, Damageable
{
  public static readonly MAX_INVENTORY_SLOTS = 8;
  public static readonly MAX_HEALTH = 3;
  public static readonly MAX_INTERACT_RADIUS = 20;

  private static readonly PLAYER_WIDTH = 16;
  private static readonly PLAYER_HEIGHT = 16;
  private static readonly PLAYER_SPEED = 60;
  private static readonly DROP_COOLDOWN = 0.5;
  private static readonly HARVEST_COOLDOWN = 0.5;
  private static readonly FIRE_COOLDOWN = 0.4;
  private static readonly CONSUME_COOLDOWN = 0.5;

  private fireCooldown = new Cooldown(Player.FIRE_COOLDOWN);
  private dropCooldown = new Cooldown(Player.DROP_COOLDOWN);
  private interactCooldown = new Cooldown(Player.HARVEST_COOLDOWN);
  private consumeCooldown = new Cooldown(Player.CONSUME_COOLDOWN);
  private position: Vector2 = { x: 0, y: 0 };
  private velocity: Vector2 = { x: 0, y: 0 };
  private input: Input = {
    facing: Direction.Right,
    inventoryItem: 1,
    dx: 0,
    dy: 0,
    interact: false,
    fire: false,
    drop: false,
    consume: false,
  };
  private activeItem: InventoryItem | null = null;
  private inventory: InventoryItem[] = [];
  private health = Player.MAX_HEALTH;
  private isCrafting = false;

  constructor(entityManager: EntityManager) {
    super(entityManager, Entities.PLAYER);
    if (DEBUG) {
      this.inventory = [
        { key: "Knife" },
        { key: "Pistol" },
        { key: "Shotgun" },
        { key: "Wood" },
        { key: "Wall" },
        { key: "Wall" },
        { key: "Wall" },
      ];
    }
  }

  setIsCrafting(isCrafting: boolean): void {
    this.isCrafting = isCrafting;
  }

  getIsCrafting(): boolean {
    return this.isCrafting;
  }

  isDead(): boolean {
    return this.health <= 0;
  }

  getHealth(): number {
    return this.health;
  }

  getMaxHealth(): number {
    return Player.MAX_HEALTH;
  }

  getDamageBox(): Hitbox {
    return {
      x: this.position.x,
      y: this.position.y,
      width: Player.PLAYER_WIDTH,
      height: Player.PLAYER_HEIGHT,
    };
  }

  damage(damage: number): void {
    this.health = Math.max(this.health - damage, 0);

    const sound = new Sound(this.getEntityManager(), SOUND_TYPES.PLAYER_HURT);
    sound.setPosition(this.getCenterPosition());
    this.getEntityManager().addEntity(sound);

    if (this.health <= 0) {
      this.onDeath();
    }
  }

  onDeath(): void {
    this.setIsCrafting(false);
    this.scatterInventory();
  }

  scatterInventory(): void {
    const offset = 32;
    this.inventory.forEach((item) => {
      const entity = this.convertItemToEntity(item);
      const theta = Math.random() * 2 * Math.PI;
      const radius = Math.random() * offset;
      (entity as unknown as Positionable).setPosition({
        x: this.position.x + radius * Math.cos(theta),
        y: this.position.y + radius * Math.sin(theta),
      });
      this.getEntityManager().addEntity(entity);
    });
  }

  isInventoryFull(): boolean {
    return this.inventory.length >= Player.MAX_INVENTORY_SLOTS;
  }

  hasInInventory(key: ItemType): boolean {
    return this.inventory.some((it) => it.key === key);
  }

  getCenterPosition(): Vector2 {
    return {
      x: this.position.x + Player.PLAYER_WIDTH / 2,
      y: this.position.y + Player.PLAYER_HEIGHT / 2,
    };
  }

  serialize(): RawEntity {
    return {
      ...super.serialize(),
      inventory: this.inventory,
      activeItem: this.activeItem,
      position: this.position,
      velocity: this.velocity,
      health: this.health,
      isCrafting: this.isCrafting,
    };
  }

  getHitbox(): Hitbox {
    const amount = 2;
    return {
      x: this.position.x + amount,
      y: this.position.y + amount,
      width: Player.PLAYER_WIDTH - amount * 2,
      height: Player.PLAYER_HEIGHT - amount * 2,
    };
  }

  setVelocityFromInput(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) {
      this.velocity = { x: 0, y: 0 };
      return;
    }

    const normalized = normalizeVector({ x: dx, y: dy });
    this.velocity = {
      x: normalized.x * Player.PLAYER_SPEED,
      y: normalized.y * Player.PLAYER_SPEED,
    };
  }

  setVelocity(velocity: Vector2) {
    this.velocity = velocity;
  }

  getVelocity(): Vector2 {
    return this.velocity;
  }

  getPosition(): Vector2 {
    return this.position;
  }

  getInventory(): InventoryItem[] {
    return this.inventory;
  }

  getActiveWeapon(): InventoryItem | null {
    const activeKey = this.activeItem?.key ?? "";
    return ["Knife", "Shotgun", "Pistol"].includes(activeKey) ? this.activeItem : null;
  }

  setPosition(position: Vector2) {
    this.position = position;
  }

  craftRecipe(recipe: RecipeType): void {
    const foundRecipe = recipes.find((it) => it.getType() === recipe);

    if (foundRecipe === undefined) {
      return;
    }

    this.inventory = foundRecipe.craft(this.inventory);
    this.setIsCrafting(false);
  }

  handleAttack(deltaTime: number) {
    this.fireCooldown.update(deltaTime);

    if (!this.input.fire) return;

    const activeWeapon = this.getActiveWeapon();
    if (activeWeapon === null) return;

    if (this.fireCooldown.isReady()) {
      this.fireCooldown.reset();

      if (activeWeapon.key === "Pistol") {
        const bullet = new Bullet(this.getEntityManager());
        bullet.setPosition({
          x: this.position.x + Player.PLAYER_WIDTH / 2,
          y: this.position.y + Player.PLAYER_HEIGHT / 2,
        });
        bullet.setDirection(this.input.facing);
        this.getEntityManager().addEntity(bullet);

        const sound = new Sound(this.getEntityManager(), "pistol");
        sound.setPosition({
          x: this.position.x + Player.PLAYER_WIDTH / 2,
          y: this.position.y + Player.PLAYER_HEIGHT / 2,
        });
        this.getEntityManager().addEntity(sound);
      } else if (activeWeapon.key === "Shotgun") {
        // Create 3 bullets with spread
        const spreadAngle = 2; // degrees
        for (let i = -1; i <= 1; i++) {
          const bullet = new Bullet(this.getEntityManager());
          bullet.setPosition({
            x: this.position.x + Player.PLAYER_WIDTH / 2,
            y: this.position.y + Player.PLAYER_HEIGHT / 2,
          });
          bullet.setDirectionWithOffset(this.input.facing, i * spreadAngle);
          this.getEntityManager().addEntity(bullet);
        }
      }
    }
  }

  handleMovement(deltaTime: number) {
    const previousX = this.position.x;
    const previousY = this.position.y;

    this.position.x += this.velocity.x * deltaTime;

    if (this.getEntityManager().isColliding(this, [Entities.PLAYER])) {
      this.position.x = previousX;
    }

    this.position.y += this.velocity.y * deltaTime;

    if (this.getEntityManager().isColliding(this, [Entities.PLAYER])) {
      this.position.y = previousY;
    }
  }

  handleInteract(deltaTime: number) {
    this.interactCooldown.update(deltaTime);

    if (!this.input.interact) return;

    if (this.interactCooldown.isReady()) {
      this.interactCooldown.reset();
      // TODO: make a more abstract method where I can pass in an InteractableKey and get the correct entities back
      const entities = this.getEntityManager()
        .getNearbyEntities(this.position, Player.MAX_INTERACT_RADIUS)
        .filter((entity) => InteractableKey in entity) as unknown as Interactable[];

      // TODO: feels like this could be a helper
      const byProximity = entities.sort((a, b) => {
        return distance(this.position, a.getPosition()) - distance(this.position, b.getPosition());
      });

      if (byProximity.length > 0) {
        byProximity[0].interact(this);
      }
    }
  }

  convertItemToEntity(item: InventoryItem): Entity {
    let entity: Entity;
    switch (item.key) {
      case "Knife":
      case "Pistol":
      case "Shotgun":
        entity = new Weapon(this.getEntityManager(), item.key);
        break;
      case "Wood":
        entity = new Tree(this.getEntityManager());
        break;
      case "Wall":
        entity = new Wall(this.getEntityManager(), item.state?.health);
        break;
      case "Bandage":
        entity = new Bandage(this.getEntityManager());
        break;
      default:
        throw new Error(`Unknown item type: '${item.key}'`);
    }

    return entity;
  }

  handleDrop(deltaTime: number) {
    this.dropCooldown.update(deltaTime);

    if (!this.input.drop) return;

    if (this.dropCooldown.isReady() && this.input.inventoryItem !== null) {
      this.dropCooldown.reset();
      const itemIndex = this.input.inventoryItem - 1;
      const item = this.inventory[itemIndex];

      if (item) {
        // Remove item from inventory
        this.inventory.splice(itemIndex, 1);

        // Create new entity based on item type
        const entity = this.convertItemToEntity(item);

        // Position the entity at player's center
        if ("setPosition" in entity) {
          const offset = 16;
          let dx = 0;
          let dy = 0;

          if (this.input.facing === Direction.Up) {
            dy = -offset;
          } else if (this.input.facing === Direction.Down) {
            dy = offset;
          } else if (this.input.facing === Direction.Left) {
            dx = -offset;
          } else if (this.input.facing === Direction.Right) {
            dx = offset;
          }

          (entity as unknown as Positionable).setPosition({
            x: this.getPosition().x + dx,
            y: this.getPosition().y + dy,
          });
        }

        this.getEntityManager().addEntity(entity);

        // Clear active item if it was dropped
        if (this.activeItem === item) {
          this.activeItem = null;
        }
      }
    }
  }

  handleConsume(deltaTime: number) {
    this.consumeCooldown.update(deltaTime);

    if (!this.input.consume) return;

    if (this.consumeCooldown.isReady() && this.input.inventoryItem !== null) {
      this.consumeCooldown.reset();
      const itemIndex = this.input.inventoryItem - 1;
      const item = this.inventory[itemIndex];

      if (item) {
        // Create temporary entity to check if it's consumable
        let entity: Entity;
        switch (item.key) {
          case "Bandage":
            entity = new Bandage(this.getEntityManager());
            break;
          default:
            return; // Not a consumable item
        }

        if (ConsumableKey in entity) {
          const consumable = entity as unknown as Consumable;

          if (consumable.consume(this)) {
            this.inventory.splice(itemIndex, 1);

            if (this.activeItem === item) {
              this.activeItem = null;
            }
          }
        }
      }
    }
  }

  update(deltaTime: number) {
    if (this.isCrafting) {
      return;
    }

    if (this.isDead()) {
      return;
    }

    if (this.input.inventoryItem !== null) {
      this.activeItem = this.inventory[this.input.inventoryItem - 1];
    }

    this.handleAttack(deltaTime);
    this.handleMovement(deltaTime);
    this.handleInteract(deltaTime);
    this.handleDrop(deltaTime);
    this.handleConsume(deltaTime);
  }

  setInput(input: Input) {
    this.input = input;
  }

  heal(amount: number): void {
    this.health = Math.min(this.health + amount, Player.MAX_HEALTH);
  }
}
