class MainScene extends Phaser.Scene {
	constructor() {
		super("MainScene");
	}

	preload() {
		// Images
		this.load.image("background", "/asset/BG full.png");
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
		this.cameras.main
			.setBounds(0, 0, worldWidth, worldHeight)
			.setBackgroundColor("#87CEEB");

		this.add.image(0, 0, "background").setOrigin(0).setScrollFactor(0);

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
		this.physics.add.overlap(this.player, this.keys, (player, key) =>
			key.destroy()
		);

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
				if (this.gameOver) return;
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
			if (!this.levelComplete) {
				this.levelComplete = true;
				this.sfx.level.play();
				this.gate.setTexture("gateOpen");
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

		const margin = 50;
		const btnSize = 100;

		// Left movement controls
		this.leftBtn = this.add
			.text(margin, 1080 - margin, "←", {
				fontSize: "48px",
				backgroundColor: "#000000aa",
				color: "#ffffff",
				padding: { x: 20, y: 10 },
				fixedWidth: btnSize,
				fixedHeight: btnSize,
				align: "center",
			})
			.setOrigin(0, 1)
			.setInteractive();

		this.rightBtn = this.add
			.text(margin + btnSize + 20, 1080 - margin, "→", {
				fontSize: "48px",
				backgroundColor: "#000000aa",
				color: "#ffffff",
				padding: { x: 20, y: 10 },
				fixedWidth: btnSize,
				fixedHeight: btnSize,
				align: "center",
			})
			.setOrigin(0, 1)
			.setInteractive();

		// Right side controls
		this.jumpBtn = this.add
			.text(1920 - margin, 1080 - margin, "JUMP", {
				fontSize: "32px",
				backgroundColor: "#000000aa",
				color: "#ffffff",
				padding: { x: 20, y: 10 },
				fixedWidth: 120,
				fixedHeight: 80,
				align: "center",
			})
			.setOrigin(1, 1)
			.setInteractive();

		this.shieldBtn = this.add
			.text(1920 - margin - 140, 1080 - margin, "SHIELD", {
				fontSize: "28px",
				backgroundColor: "#000000aa",
				color: "#ffffff",
				padding: { x: 15, y: 10 },
				fixedWidth: 120,
				fixedHeight: 80,
				align: "center",
			})
			.setOrigin(1, 1)
			.setInteractive();

		// Make sure UI camera only sees these buttons
		this.cameras.main.ignore([
			this.leftBtn,
			this.rightBtn,
			this.jumpBtn,
			this.shieldBtn,
		]);
		this.uiCamera.ignore(
			this.children.list.filter(
				(child) =>
					child !== this.leftBtn &&
					child !== this.rightBtn &&
					child !== this.jumpBtn &&
					child !== this.shieldBtn
			)
		);

		// Button events
		this.leftPressed = false;
		this.rightPressed = false;

		this.leftBtn.on("pointerdown", () => (this.leftPressed = true));
		this.leftBtn.on("pointerup", () => (this.leftPressed = false));
		this.leftBtn.on("pointerout", () => (this.leftPressed = false));

		this.rightBtn.on("pointerdown", () => (this.rightPressed = true));
		this.rightBtn.on("pointerup", () => (this.rightPressed = false));
		this.rightBtn.on("pointerout", () => (this.rightPressed = false));

		this.jumpBtn.on("pointerdown", () => {
			if (this.player.body.touching.down) {
				this.player.setVelocityY(-700);
				this.sfx.jump.play();
			}
		});

		// Track shield button hold state
		this.shieldBtnPressed = false;
		this.shieldBtn
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
		if (this.gameOver) return;

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
			if (this.cursors.left.isDown || this.wasd.left.isDown || this.leftPressed)
				moveX = -speed;
			else if (
				this.cursors.right.isDown ||
				this.wasd.right.isDown ||
				this.rightPressed
			)
				moveX = speed;
			this.player.setVelocityX(moveX);

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
		this.time.delayedCall(3000, () => this.scene.restart());
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
