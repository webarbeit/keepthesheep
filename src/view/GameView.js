import device;
import ui.View;
import ui.TextView;
import math.geom.Rect as Rect;
import math.geom.Circle as Circle;
import math.util as util;
import math.geom.intersect as intersect;
import src.engine.Queue as Queue;
import src.model.Sheep as Sheep;
import src.model.EnemyWolf as EnemyWolf;
import src.model.Border as Border;
import src.model.Bail as Bail;
import math.geom.Line as Line;
import animate;

/**
 * GameView
 * @author: webarbeit@gmail.com
 * The view where the game takes place
 */

exports = Class(ui.View, function (supr) {
  this.totalW = 0;
  this.totalH = 0;
  this.BORDER_OFFSET = 50;
  this.countup = null;
  this.doCount = false;
  this.countSeconds = 0;
  this.entities = [];
  this.startAmountOfSheeps = 3;
  this.countSheep = 0;
  this.isEnd = false;
  this.queue = null;
  this.sheepEntities = [];

  this.init = function (opts) {
    opts = merge(opts, {
      backgroundColor: '#70A430',
      clip: true
    });
    this.name = 'GameView';
    supr(this, 'init', [opts]);
    this.totalW = this.style.width;
    this.totalH = this.style.height;
    this.centerX = this.totalW / 2;
    this.centerY = this.totalH / 2;
    this.queue = new Queue(this);
  };

  this.start = function() {
    animate(this).wait(1000).then({
      scale: 1
    }, 1000);
    this.reset();
    this.removeAllSubviews();
    this.addCounterView();
    this.startCount();
    this.addBorders();
    this.addCreatures();

    this.queue.add('addBail', [30000, 60000]);
    this.queue.add('spawnSheeps', 30000);
    //this.queue.add('spawnWolf', 2000);
  };

  this.reset = function() {
    this.stopCount();
    this.countSeconds = 0;
    if (this.countup) {
      this.countup.setText(0);
    }
    this.queue.reset();
    this.entities = [];
    this.isEnd = false;
  };

  this.lose = function() {
    if (this.isEnd) return;
    this.isEnd = true;
    setTimeout(bind(this, function() {
      this.emit('gameView:end', {
        time: this.countSeconds,
        timeAsString: this.countup.getText(),
        countSheep: this.countSheep
      });
      this.reset();
    }), 2000);
  };

  this.shapeIsRect = function(shape) {
    return shape instanceof Rect;
  };

  this.shapeIsCircle = function(shape) {
    return shape instanceof Circle;
  };

  this.intersectCircles = function(circle1, circle2, radius) {
    var distance = new Line(circle1.x, circle1.y, circle2.x, circle2.y).getLength();
    return distance <= radius;
  };

  this.tick = function (dt) {
    var numberOfEntities = this.entities.length;
    var hasCollidedWithOne = false;

    for (var i = 0; i < numberOfEntities; i++) {
      var currentEntity = this.entities[i];

      // A sheep is dead, end the game
      if (currentEntity.type === 'Sheep' && currentEntity.isDead) {
        this.lose();
        break;
      }

      hasCollidedWithOne = false;
      // Loop through all other entities to check if they collide
      for (var k = 0; k < numberOfEntities; k++) {
        var otherEntity = this.entities[k];
        // Skip if it is the same entity OR if it can not collide with other entity
        if (i === k || !currentEntity.canCollideWith(otherEntity)) { continue };

        var currentShape = currentEntity.getCollisionShape(otherEntity.type);
        if (!currentShape) break;
        var hasCollided = false;
        var otherShape = otherEntity.getCollisionShape(currentShape.entity);
        if (otherShape) {

          if (this.shapeIsRect(currentShape) && this.shapeIsRect(otherShape)) {
            hasCollided = intersect.rectAndRect(currentShape, otherShape);
          } else if (this.shapeIsCircle(currentShape) && this.shapeIsRect(otherShape)) {
            hasCollided = intersect.circleAndRect(currentShape, otherShape);
          } else if (this.shapeIsRect(currentShape) && this.shapeIsCircle(otherShape)) {
            hasCollided = intersect.circleAndRect(otherShape, currentShape);
          } else {
            hasCollided = this.intersectCircles(currentShape, otherShape, currentShape.radius);
          }

          if (hasCollided) {
            hasCollidedWithOne = true;
            currentEntity.collidesWith(otherEntity);
          }

        }
      }
      currentEntity.setIsInCollision(hasCollidedWithOne);

    }
    this.queue.workQueue();
  };

  this.getSheepObject = function(pos) {
    var sheep = new Sheep({
      x: pos.x,
      y: pos.y,
      maxWorldX: this.totalW,
      maxWorldY: this.totalH
    });
    this.countSheep++;
    return sheep;
  };

  this.spawnSheeps = function() {
    var pos = this.getRandomSheepSpawnPosition();
    var sheep = this.getSheepObject(pos);
    sheep.isGhost = true;
    this.addEntity(sheep);
    sheep.blink(0);
    sheep.moveTo(this.totalW / 2, this.totalH / 2).then(bind(sheep, function() {
      sheep.isGhost = false;
    }));
    this.queue.add('spawnSheeps', [13000, 100000]);
  };

  this.spawnWolf = function() {
    var pos = this.getRandomPositionOnEdge();
    var wolf = new EnemyWolf({
      x: pos.x,
      y: pos.y,
      maxWorldX: this.totalW,
      maxWorldY: this.totalH
    });
    this.addEntity(wolf);
    wolf.on('Wolf:readyToAttack', bind(this, function() {
      var sheep = this.getRandomSheep();
      wolf.attack(sheep);
    }));
  };

  this.addEntity = function(entity) {
    if (!entity) { throw 'No entity to add - missing param'; }
    this.entities.push(entity);
    if (entity.type === 'Sheep') {
      this.sheepEntities.push(entity);
    }
    this.addSubview(entity);
  };

  this.getRandomSheep = function() {
    return this.sheepEntities[0, util.random(this.sheepEntities.length - 1)];
  };

  this.getRandomPositionOnEdge = function() {
    var offset = this.BORDER_OFFSET;
    var x = 0;
    var y = 0;
    var edges = ['top', 'right', 'bottom', 'left'];
    var edge = edges[util.random(0, edges.length - 1)];

    // TOP
    if (edge === edges[0]) {
      x = util.random(offset, this.totalW - offset);
    // RIGHT
    } else if (edge === edges[1]) {
      x = this.totalW;
      y = util.random(offset, this.totalH - offset);
    // BOTTOM
    } else if (edge === edges[2]) {
      x = util.random(offset, this.totalW - offset);
      y = this.totalH;
    // LEFT
    } else {
      x = 0;
      y = util.random(offset, this.totalH - offset);
    }

    return {
      x: x,
      y: y
    };
  };

  this.getRandomSheepSpawnPosition = function() {
    var offset = 20;
    var corners = [
      // Left Top
      [offset, offset],
      // Right Top
      [this.totalW - offset, offset],
      // Left Bottom
      [offset, this.totalH - offset],
      // Right bottom
      [this.totalW - offset, this.totalH - offset]
    ];
    var corner = corners[util.random(0, corners.length - 1)];
    return {x: corner[0], y: corner[1]};
  };

  this.getRandomSheepStartPosition = function() {
    var minOffset = this.BORDER_OFFSET * 5;
    var min_x = minOffset;
    var max_x = this.totalW - minOffset;
    var min_y = minOffset;
    var max_y = this.totalH - minOffset;
    var x = util.random(min_x, max_x);
    var y = util.random(min_y, max_y);
    return {x: x, y: y};
  };

  this.addCreatures = function() {
    for (var i = 0; i < this.startAmountOfSheeps; i++) {
      var pos = this.getRandomSheepStartPosition();
      var sheep = this.getSheepObject(pos);
      this.addEntity(sheep);
      sheep.queue.add('moveRandomly', [2000, 3000]);
    }
  };

  this.addBail = function() {
    var x = this.totalW / 2;
    var y = this.totalH / 2;
    var bail = new Bail({
      x: x,
      y: y
    });
    this.addSubview(bail);
    bail.on('Bail:tapped', bind(this, function() {
      this.moveSheepsNearPoint(x, y);
      this.queue.add('addBail', [30000, 60000]);
    }));
  };

  this.moveSheepsNearPoint = function(x, y) {
    for (var i = 0; i < this.entities.length; i++) {
      var e = this.entities[i];
      if (e.type === 'Sheep' && !e.isDead) {
        e.queue.cleanUp();
        e.moveTo.call(e, x, y).then(bind(e, function() {
          this.moveRandomly.call(this);
        }));
      }
    }
  };

  this.addArea = function(offset, lineWidth) {
    var totalW = this.totalW;
    var totalH = this.totalH;
    var edges = [
      // TOP
      {
        x: offset + lineWidth,
        y: offset,
        width: totalW - offset * 2 - lineWidth,
        height: lineWidth
      },
      // Bottom
      {
        x: offset + lineWidth,
        y: totalH - offset,
        width: totalW - offset * 2 - lineWidth,
        height: lineWidth
      },
      // Left
      {
        x: offset,
        y: offset + lineWidth,
        width: lineWidth,
        height: totalH - offset * 2 - lineWidth
      },
      // Right
      {
        x: totalW - offset,
        y: offset + lineWidth,
        width: lineWidth,
        height: totalH - offset * 2 - lineWidth
      }
    ];
    for (var i = 0; i < edges.length; i++) {
      this.addEntity(new Border(edges[i]));
    }
  };

  this.addBorders = function() {
    this.addArea(this.BORDER_OFFSET, 20);
  };

  this.addCounterView = function() {
    // TODO: User ScoreView instead
    // http://docs.gameclosure.com/example/text-scoreview/
    this.countup = new ui.TextView({
      superview: this,
      visible: true,
      x: this.style.width / 2 - 50,
      y: -15,
      width: 100,
      height: 80,
      size: 80,
      color: '#fff'
    });
  };

  this.startCount = function() {
    this.doCount = true;
    this.countup.setText('00:00');
    this.increaseCounter();
  };

  this.stopCount = function() {
    this.doCount = false;
  };

  this.increaseCounter = function() {
    var zero = function(num) {
      return num < 10 ? '0' + num : num;
    };
    var current = this.countSeconds;
    var minutes = Math.floor(current / 60);
    var seconds = current - (minutes * 60);
    var formated = zero(minutes) + ':' + zero(seconds);
    this.countup.setText(formated);

    this.countSeconds++;
    if (!this.doCount) {
      return;
    }
    this.queue.add('increaseCounter', 1000);
  };

});