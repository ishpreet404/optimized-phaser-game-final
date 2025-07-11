class MainScene extends Phaser.Scene {
	constructor() {
		super("MainScene");
	}

	preload() {
		// Images
		this.load.image("background", "/asset/BGfull.png");
		this.load.image("backgroundMobile", "/asset/background.jpg");
		this.load.image("cloud", "/asset/Cloud1.png");
		this.load.image("player", "/asset/Psyger-0.png");
		this.load.image("sun", "/asset/Suhn.png");
		this.load.image("fireball", "/asset/Fireball.png");
		this.load.image("gem", "/asset/Gem.png");
		this.load.image("key", "/asset/Key.png");
		this.load.image("gateClosed", "/asset/GateClosed.png");
		this.load.image("gateOpen", "/asset/GateOpen.png");
		this.load.image("shieldOverlay", "/asset/Shield.png");
		this.load.image("gameStart", "/asset/GameStart.png");
		this.load.image("gameOver", "/asset/GameOver.png");
		for (let i = 0; i <= 3; i++) {
			this.load.image(`health${i}`, `/asset/Health${i}.png`);
			this.load.image(`shield${i}`, `/asset/Shield${i}.png`);
		}

		// Audio
		this.load.audio("bgm", "sounds/bgmusic.mp3"); // Use any bg music file you have
		this.load.audio(
			"levelComplete",
			"sounds/122255__jivatma07__level_complete.wav"
		);
		this.load.audio(
			"collectCoin",
			"sounds/135936__bradwesson__collectcoin.wav"
		);
		this.load.audio(
			"magicShield",
			"sounds/249818__spookymodem__magic-shield.wav"
		);
		this.load.audio("gameDie", "sounds/364929__jofae__game-die.mp3");
		this.load.audio("jump", "sounds/jump01.flac");
		this.load.audio("shieldHit", "sounds/459782__metzik__deflector-shield.wav");
		this.load.audio("click", "sounds/488534__ranner__ui-click.wav");
		this.load.audio(
			"enemyHit",
			"sounds/506586__mrthenoronha__kill-enemy-3-8-bit.wav"
		);
	}

	create() {
		// Sound Effects
		this.sfx = {
			coin: this.sound.add("collectCoin"),
			shield: this.sound.add("magicShield"),
			death: this.sound.add("gameDie"),
			jump: this.sound.add("jump"),
			hitShield: this.sound.add("shieldHit"),
			click: this.sound.add("click"),
			level: this.sound.add("levelComplete"),
			enemyHit: this.sound.add("enemyHit"),
		};

		// Background Music
		this.bgm = this.sound.add("bgm", { loop: true, volume: 0.5 });
		this.bgm.play();

		const worldWidth = 4000,
			worldHeight = 2000;
		this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
		this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

		// Detect if on mobile
		this.isMobile =
			this.sys.game.device.os.android || this.sys.game.device.os.iOS;

		if (this.isMobile) {
			this.add.image(0, 0, "backgroundMobile").setOrigin(0).setScrollFactor(0);
		} else {
			this.add.image(0, 0, "background").setOrigin(0).setScrollFactor(0);
		}

		this.fallLimitY = 1900;
		this.gameOver = false;
		this.lives = 3;
		this.shieldHitsRemaining = 3;
		this.shieldActive = false;

		// Groups
		this.cloudGroup = this.physics.add.staticGroup();
		this.gems = this.physics.add.staticGroup();
		this.keys = this.physics.add.staticGroup();

		// Clouds and items
		const cloudPositions = [],
			baseX = 100,
			baseY = 1400,
			stepX = 250,
			amp = 100;
		for (let i = 0; i < 10; i++) {
			const x = baseX + i * stepX;
			const y = baseY + (i % 2 === 0 ? -amp : amp);
			cloudPositions.push({ x, y });
		}
		const keyIndex = Phaser.Math.Between(0, cloudPositions.length - 1);
		cloudPositions.forEach((pos, index) => {
			this.cloudGroup
				.create(pos.x, pos.y, "cloud")
				.setScale(0.4)
				.refreshBody()
				.setAlpha(0.8);
			if (Math.random() < 0.3)
				this.gems
					.create(pos.x, pos.y - 50, "gem")
					.setScale(0.2)
					.refreshBody();
			if (index === keyIndex)
				this.keys
					.create(pos.x, pos.y - 60, "key")
					.setScale(0.25)
					.refreshBody();
		});

		// Player
		this.player = this.physics.add
			.sprite(100, 1000, "player")
			.setScale(0.3)
			.setBounce(0.1)
			.setCollideWorldBounds(true);
		this.shieldOverlay = this.add
			.image(0, 0, "shieldOverlay")
			.setScale(1)
			.setVisible(false)
			.setDepth(1);

		this.shieldKey = this.input.keyboard.addKey(
			Phaser.Input.Keyboard.KeyCodes.SPACE
		);
		this.physics.add.collider(this.player, this.cloudGroup, (player, cloud) => {
			if (!cloud._fadeTimerStarted) {
				cloud._fadeTimerStarted = true;
				this.time.delayedCall(5000, () => {
					this.tweens.add({
						targets: cloud,
						alpha: 0,
						duration: 800,
						onComplete: () => cloud.destroy(),
					});
				});
			}
		});

		this.physics.add.overlap(this.player, this.gems, (player, gem) => {
			this.sfx.coin.play();
			gem.destroy();
			this.shieldHitsRemaining = 3;
			this.updateBars();
		});

		// Track key collection and stop fireballs
		this.hasKey = false;
		this.physics.add.overlap(this.player, this.keys, (player, key) => {
			key.destroy();
			this.hasKey = true;
			this.sfx.coin.play(); // Play sound when key is collected
			console.log("Key collected! Fireballs stopped.");
		});

		this.cursors = this.input.keyboard.createCursorKeys();
		this.wasd = this.input.keyboard.addKeys({
			up: "W",
			left: "A",
			down: "S",
			right: "D",
		});

		this.cameras.main.startFollow(this.player, true, 1.0, 1.0).setZoom(1.7);
		this.sun = this.add
			.image(0, 0, "sun")
			.setOrigin(1, 0)
			.setScale(0.5)
			.setDepth(100);

		// Fireballs
		this.fireballs = this.physics.add.group({
			defaultKey: "fireball",
			maxSize: 80,
		});
		this.time.addEvent({
			delay: 2000,
			callback: () => {
				if (this.gameOver || this.hasKey || this.levelComplete) return; // Stop fireballs if key collected or level complete
				const originX =
					this.cameras.main.scrollX + this.cameras.main.width - 80;
				const originY = this.cameras.main.scrollY + 80;
				const baseAngle = Phaser.Math.Angle.Between(
					originX,
					originY,
					this.player.x,
					this.player.y
				);
				[-0.25, -0.1, 0.1, 0.25].forEach((offset) => {
					const angle = baseAngle + offset;
					const fireball = this.fireballs.get();
					if (fireball) {
						fireball.setActive(true).setVisible(true).setScale(0.2);
						fireball.body.reset(originX, originY);
						fireball.setVelocity(
							Math.cos(angle) * 1000,
							Math.sin(angle) * 1000
						);
					}
				});
			},
			loop: true,
		});

		this.physics.add.overlap(
			this.player,
			this.fireballs,
			(player, fireball) => {
				fireball.disableBody(true, true);
				if (this.shieldActive && this.shieldHitsRemaining > 0) {
					this.sfx.hitShield.play();
					this.shieldHitsRemaining--;
					this.updateBars();
					if (this.shieldHitsRemaining <= 0) {
						this.shieldActive = false;
					}
				} else {
					this.handlePlayerHit();
				}
			}
		);

		// Gate
		const lastCloud = cloudPositions[cloudPositions.length - 1];
		this.gate = this.physics.add
			.staticImage(lastCloud.x + 200, lastCloud.y - 60, "gateClosed")
			.setScale(0.4)
			.refreshBody();
		this.levelComplete = false;
		this.physics.add.overlap(this.player, this.gate, () => {
			if (!this.levelComplete && this.hasKey) {
				this.levelComplete = true;
				this.sfx.level.play();
				this.gate.setTexture("gateOpen");
				this.showLevelCompleteScreen();
			}
		});

		// UI
		this.startScreen = this.add
			.image(960, 540, "gameStart")
			.setDepth(999)
			.setScrollFactor(0)
			.setScale(0.6)
			.setInteractive()
			.setVisible(true);
		this.startScreen.on("pointerdown", () => {
			this.sfx.click.play();
			this.startScreen.setVisible(false);
			this.physics.resume();
			this.gameStarted = true;
		});
		this.physics.pause();

		this.gameOverScreen = this.add
			.image(960, 540, "gameOver")
			.setDepth(999)
			.setScrollFactor(0)
			.setScale(0.6)
			.setVisible(false);

		// Create level complete screen as text
		this.levelCompleteScreen = this.add
			.text(960, 540, "LEVEL COMPLETED!\n\nPress any key or tap to continue", {
				fontSize: "48px",
				fill: "#00ff00",
				backgroundColor: "#000000cc",
				padding: { x: 40, y: 40 },
				align: "center",
			})
			.setOrigin(0.5)
			.setDepth(10000)
			.setScrollFactor(0)
			.setVisible(false);

		this.healthImage = this.add
			.image(650, 250, "health3")
			.setScrollFactor(0)
			.setScale(0.8);
		this.shieldImage = this.add
			.image(650, 300, "shield3")
			.setScrollFactor(0)
			.setScale(0.8);
		this.add
			.text(300, 245, "HEALTH", { fontSize: "20px", fill: "#fff" })
			.setScrollFactor(0);
		this.add
			.text(300, 295, "SHIELD", { fontSize: "20px", fill: "#fff" })
			.setScrollFactor(0);

		this.updateBars();
		this.createMobileControls(); // 👈 Mobile Controls
	}

	createMobileControls() {
		// Create a UI camera that isn't affected by zoom
		this.uiCamera = this.cameras.add(0, 0, 1920, 1080);
		this.uiCamera.setScroll(0, 0);

		// Joystick base and knob (black/white style)
		const joyBaseX = 180,
			joyBaseY = 900,
			joyRadius = 80;
		this.joystickBase = this.add
			.circle(joyBaseX, joyBaseY, joyRadius, 0x111111, 0.7)
			.setStrokeStyle(6, 0xffffff, 0.9);
		this.joystickKnob = this.add
			.circle(joyBaseX, joyBaseY, 38, 0xffffff, 0.98)
			.setStrokeStyle(4, 0x111111, 1)
			.setInteractive({ draggable: true });
		this.joystickVector = { x: 0, y: 0 };

		// Enable multitouch for mobile
		if (this.sys.game.device.input.touch) {
			this.input.addPointer(2); // Allow 2+ simultaneous touches
		}

		this.joystickKnob.on("drag", (pointer, dragX, dragY) => {
			const dx = dragX - joyBaseX,
				dy = dragY - joyBaseY;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist > joyRadius) {
				const angle = Math.atan2(dy, dx);
				this.joystickKnob.x = joyBaseX + Math.cos(angle) * joyRadius;
				this.joystickKnob.y = joyBaseY + Math.sin(angle) * joyRadius;
			} else {
				this.joystickKnob.x = dragX;
				this.joystickKnob.y = dragY;
			}
			this.joystickVector.x = (this.joystickKnob.x - joyBaseX) / joyRadius;
			this.joystickVector.y = (this.joystickKnob.y - joyBaseY) / joyRadius;
		});
		this.joystickKnob.on("dragend", () => {
			this.tweens.add({
				targets: this.joystickKnob,
				x: joyBaseX,
				y: joyBaseY,
				duration: 120,
				ease: "Back.easeOut",
			});
			this.joystickVector.x = 0;
			this.joystickVector.y = 0;
		});

		// --- Black & White Mobile Controls ---
		// All controls (joystick, jump, shield) will use only black, white, and gray
		// Both jump and shield buttons will be the same size
		const btnX1 = 1720,
			btnX2 = 1550,
			btnY = 900,
			btnR = 65;
		// Jump Button
		this.jumpBtn = this.add.graphics();
		this.jumpBtn.fillStyle(0x111111, 0.32).fillCircle(6, 12, btnR + 4); // shadow
		this.jumpBtn.fillStyle(0xffffff, 1).fillCircle(0, 0, btnR * 0.82);
		this.jumpBtn.fillStyle(0xdddddd, 1).fillCircle(0, 0, btnR * 0.97);
		this.jumpBtn.fillStyle(0x222222, 1).fillCircle(0, 0, btnR * 0.7);
		this.jumpBtn
			.fillStyle(0xffffff, 0.18)
			.fillEllipse(0, -btnR * 0.45, btnR * 1.1, btnR * 0.45);
		this.jumpBtn.lineStyle(6, 0x000000, 1).strokeCircle(0, 0, btnR);
		this.jumpBtn.setPosition(btnX1, btnY);
		this.jumpBtn.setInteractive(
			new Phaser.Geom.Circle(0, 0, btnR),
			Phaser.Geom.Circle.Contains
		);
		this.jumpIcon = this.add
			.text(btnX1, btnY, "⭮", {
				fontSize: "60px",
				color: "#111",
				fontStyle: "bold",
				fontFamily: "Arial Black, Arial, sans-serif",
				stroke: "#fff",
				strokeThickness: 6,
			})
			.setOrigin(0.5)
			.setShadow(0, 6, "#000", 12, true, true);

		// Shield Button (same size, black/white)
		this.shieldBtn = this.add.graphics();
		this.shieldBtn.fillStyle(0x111111, 0.32).fillCircle(6, 12, btnR + 4); // shadow
		this.shieldBtn.fillStyle(0xffffff, 1).fillCircle(0, 0, btnR * 0.82);
		this.shieldBtn.fillStyle(0xdddddd, 1).fillCircle(0, 0, btnR * 0.97);
		this.shieldBtn.fillStyle(0x222222, 1).fillCircle(0, 0, btnR * 0.7);
		this.shieldBtn
			.fillStyle(0xffffff, 0.18)
			.fillEllipse(0, -btnR * 0.45, btnR * 1.1, btnR * 0.45);
		this.shieldBtn.lineStyle(6, 0x000000, 1).strokeCircle(0, 0, btnR);
		this.shieldBtn.setPosition(btnX2, btnY);
		this.shieldBtn.setInteractive(
			new Phaser.Geom.Circle(0, 0, btnR),
			Phaser.Geom.Circle.Contains
		);
		this.shieldIcon = this.add
			.text(btnX2, btnY, "🛡️", {
				fontSize: "60px",
				color: "#111",
				fontStyle: "bold",
				fontFamily: "Arial Black, Arial, sans-serif",
				stroke: "#fff",
				strokeThickness: 6,
			})
			.setOrigin(0.5)
			.setShadow(0, 6, "#000", 12, true, true);

		// UI camera ignores everything else
		this.cameras.main.ignore([
			this.joystickBase,
			this.joystickKnob,
			this.jumpBtn,
			this.jumpIcon,
			this.shieldBtn,
			this.shieldIcon,
		]);
		this.uiCamera.ignore(
			this.children.list.filter(
				(child) =>
					![
						this.joystickBase,
						this.joystickKnob,
						this.jumpBtn,
						this.jumpIcon,
						this.shieldBtn,
						this.shieldIcon,
					].includes(child)
			)
		);

		// Button events
		this.jumpBtn
			.setInteractive(
				new Phaser.Geom.Circle(0, 0, 65),
				Phaser.Geom.Circle.Contains
			)
			.on("pointerdown", () => {
				if (this.player.body.touching.down) {
					this.player.setVelocityY(-700);
					this.sfx.jump.play();
				}
			});
		this.shieldBtnPressed = false;
		this.shieldBtn
			.setInteractive(
				new Phaser.Geom.Circle(0, 0, 55),
				Phaser.Geom.Circle.Contains
			)
			.on("pointerdown", () => (this.shieldBtnPressed = true))
			.on("pointerup", () => (this.shieldBtnPressed = false))
			.on("pointerout", () => (this.shieldBtnPressed = false));

		// Always update shield overlay position and visibility
		this.events.on("postupdate", () => {
			this.shieldOverlay.setVisible(
				this.shieldActive && this.shieldHitsRemaining > 0
			);
			this.shieldOverlay.setPosition(this.player.x, this.player.y);
		});
	}

	update() {
		if (this.gameOver || this.levelComplete) return; // Stop all updates if game over or level complete

		if (this.player.y > this.fallLimitY) {
			this.lives = 0;
			this.updateBars();
			this.triggerGameOver();
			return;
		}

		const speed = 200;
		// Only activate shield while SPACE or shield button is held
		const isShieldDown = this.shieldKey.isDown || this.shieldBtnPressed;
		this.shieldActive = isShieldDown && this.shieldHitsRemaining > 0;

		if (!this.shieldActive) {
			let moveX = 0;
			// Joystick input (mobile)
			if (this.joystickVector && Math.abs(this.joystickVector.x) > 0.15) {
				moveX = this.joystickVector.x * speed;
			} else if (this.cursors.left.isDown || this.wasd.left.isDown) {
				moveX = -speed;
			} else if (this.cursors.right.isDown || this.wasd.right.isDown) {
				moveX = speed;
			}
			this.player.setVelocityX(moveX);
			// Keyboard jump (desktop)
			if (
				(this.cursors.up.isDown || this.wasd.up.isDown) &&
				this.player.body.touching.down
			) {
				this.player.setVelocityY(-700);
				this.sfx.jump.play();
			}
		} else {
			this.player.setVelocityX(0);
		}

		this.fireballs.children.iterate((fb) => {
			if (
				fb &&
				fb.active &&
				(fb.x < 0 || fb.x > 4000 || fb.y < 0 || fb.y > 2000)
			) {
				fb.disableBody(true, true);
			}
		});

		const cam = this.cameras.main;
		this.sun.x = cam.scrollX + cam.width / cam.zoom + 430;
		this.sun.y = cam.scrollY + 150;
	}

	showLevelCompleteScreen() {
		this.physics.pause();
		this.player.setVelocity(0, 0);
		this.levelCompleteScreen.setVisible(true);

		// Debug: log to confirm function is called
		console.log("Level complete screen should be visible");

		// Restart on any key or pointer down
		this.input.keyboard.once("keydown", () => this.scene.restart());
		this.input.once("pointerdown", () => this.scene.restart());
	}

	handlePlayerHit() {
		this.lives--;
		this.updateBars();
		this.sfx.enemyHit.play();
		if (this.lives <= 0) this.triggerGameOver();
	}

	updateBars() {
		const clampedLives = Phaser.Math.Clamp(this.lives, 0, 3);
		const clampedShield = Phaser.Math.Clamp(this.shieldHitsRemaining, 0, 3);
		this.healthImage.setTexture("health" + clampedLives);
		this.shieldImage.setTexture("shield" + clampedShield);
	}

	triggerGameOver() {
		this.gameOver = true;
		this.physics.pause();
		this.player.setTint(0xff0000);
		this.player.setVelocity(0, 0);
		this.shieldOverlay.setVisible(false);
		this.sfx.death.play();
		this.gameOverScreen.setVisible(true);

		// Restart on any key or pointer down
		this.input.keyboard.once("keydown", () => this.scene.restart());
		this.input.once("pointerdown", () => this.scene.restart());
	}
}

// Game config
const config = {
	type: Phaser.AUTO,
	backgroundColor: "#000000",
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
		width: 1920,
		height: 1080,
	},
	scene: MainScene,
	physics: {
		default: "arcade",
		arcade: { gravity: { y: 1000 }, debug: false },
	},
};

const game = new Phaser.Game(config);

// Request fullscreen on first pointer down (desktop and mobile, all browsers)
window.addEventListener(
	"pointerdown",
	() => {
		const canvas = document.querySelector("canvas");
		if (!canvas) return;
		if (canvas.requestFullscreen) {
			canvas.requestFullscreen();
		} else if (canvas.webkitRequestFullscreen) {
			canvas.webkitRequestFullscreen();
		} else if (canvas.msRequestFullscreen) {
			canvas.msRequestFullscreen();
		} else if (canvas.mozRequestFullScreen) {
			canvas.mozRequestFullScreen();
		}
	},
	{ once: true }
);

// Refresh page if phone is rotated to landscape or portrait
window.addEventListener("orientationchange", () => {
	// Always reload on orientation change
	location.reload();
});
