// Island Loop P1 — Mũi Hải Đăng. Cấu hình chung cho mọi module.
// ?fast=1 — chế độ kiểm thử logic: tắt bóng đổ + pixelRatio 1 cho SwiftShader chạy nhanh.
export const FAST = new URLSearchParams(location.search).has('fast');

// Mobile: UA mobile hoặc màn hình nhỏ có cảm ứng → bật đường render nhẹ
// (tắt MSAA, pixelRatio thấp, bóng đổ rẻ, shader nước gọn).
export const MOBILE = /Mobi|Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
  || (Math.min(window.innerWidth, window.innerHeight) < 700 && 'ontouchstart' in window);

export const CONFIG = {
  seed: 20261001,

  // ĐỊA HÌNH: heightfield đồi lượn sóng tự nhiên (xem terrain.js).
  // Mũi đá hải đăng là ĐIỂM CAO của cùng địa hình (gò gaussian cộng vào đồi),
  // ở góc đông đảo, sườn đông dốc xuống gần mép biển như ảnh mẫu.
  cliff: { x: 88, z: -5, bumpH: 30, bumpR: 26, padFlat: 8, padBlend: 8, padHeight: 30 },
  island: { domeH: 13, domeR: 105 },

  // Vùng đất bằng cho P2 làng chài (~40×40m): terrain.js san phẳng tại đây,
  // vegetation.js không trồng cây rậm trong vùng này. Gần bãi biển phía tây.
  village: {
    x: -72, z: 6, flatR: 22, blendR: 10,
    // Asset P2 — BẮT BUỘC dùng bản _game (bản gốc 2 nhà medieval render xám
    // do material KHR_materials_pbrSpecularGlossiness cũ).
    models: {
      houseMain: 'models/p2/house/medieval_house_game.glb',
      houseTall: 'models/p2/house/medieval_house_1_game.glb',
      houseKit: 'models/p2/house/houses_blender_game.glb',
      boat: 'models/p2/boat/fishing_boat_game.glb',
      barrel: 'models/p2/props/barrel_game.glb',
      net: 'models/p2/props/fishing_net_game.glb',
      lantern: 'models/p2/props/lantern_game.glb',
    },
  },

  // Biển THU HẸP: chỉ là dải nền quanh đảo — đảo là trung tâm khung hình.
  // Mép biển (450m) chìm hẳn trong fade chân trời của shader (water.js).
  sea: { size: 900 },
  fog: { color: 0xcfe0f2, near: 260, far: 1200 },

  lighthouse: { pos: [88, 30, -5], model: 'models/lighthouse_game.glb' },
  house: { pos: [83, 30, 0], rotY: -0.785398, model: 'models/keeper_house_game.glb' },

  // Đường vòng P6: KHÉP KÍN quanh đảo ở vùng thấp — tuyến tham quan qua chân
  // đồi hải đăng P1 (= điểm đầu lối mòn), cụm dừa 3 bãi P3, bãi cát phía tây,
  // làng chài P2. Xe tự chạy dọc tim đường (xem car.js).
  road: { width: 6.4, lift: 0.5, samples: 700, ribbonSegs: 800 },

  // Lối mòn đất lên hải đăng (thay đường nhựa xoắn đã bỏ): hẹp ~1.9m, mặt đất
  // nện, mép mềm tan vào cỏ — xem roadpath.js (buildTrailPoints) + roads.js.
  trail: { width: 1.9, lift: 0.12 },

  // Rừng cây (instancing) — số lượng instance mỗi loại.
  // Địa hình mới: đồi cỏ phủ rừng (dày ở thung lũng/sườn thoải), thưa dần lên
  // phần đá dựng của mũi đá — như ảnh mẫu: đồi xanh, đá chỉ lộ ở mũi dựng.
  trees: {
    jabamiCounts: [64, 56, 64, 56],           // v1..v4 (rừng đồi — dày như ảnh mẫu)
    jabamiHeights: [7.0, 7.5, 5.5, 6.5],
    palmCount: 70, palmHeight: 7.0,            // dừa quanh bãi cát
    grassCount: 220, grassHeight: 0.85,        // bụi cỏ rải khắp đồi
    cliffTrees: [20, 20, 20, 20],              // jabami trên sườn mũi đá
    cliffGrass: 260,                            // bụi cỏ len lỏi sườn đá
    cliffPalms: 12,                            // dừa quanh chân mũi đá
  },

  models: {
    rocks: 'models/stylized_rock.glb',
    jabami: [
      'models/jabami/jabami_anime_tree_v1.glb',
      'models/jabami/jabami_anime_tree_v2.glb',
      'models/jabami/jabami_anime_tree_v3.glb',
      'models/jabami/jabami_anime_tree_v4.glb',
    ],
    palm: 'models/jabami/tropical_palm_tree.glb',
    grass: 'models/jabami/jabami_anime_tree-grass_v1.glb',
  },

  // Nắng chiều ấm kiểu Ghibli
  sun: { pos: [60, 170, 190], color: 0xffe7c4, intensity: 2.8 },

  // Động vật — BẮT BUỘC dùng bản _game (seagull bản gốc render đen
  // do material KHR_materials_pbrSpecularGlossiness cũ).
  animals: {
    models: {
      seagull: 'models/animals/seagull__stylized_animated_3d_model_game.glb',
      butterfly: 'models/animals/animated_butterfly_game.glb',
      crab: 'models/animals/crab_game.glb',
      turtle: 'models/animals/stylised_hawksbill_turtle_game.glb',
      fish: 'models/animals/yellow_tang_fish_game.glb',
      dog: 'models/animals/black_sausage_dog_cute_stylized_pet_animal_game.glb',
      chicken: 'models/animals/handpainted_rooster_and_hen_game.glb',
      cat: 'models/animals/orange_stray_kitten_game.glb',
      deer: 'models/animals/pack_deer_game.glb',
      boar: 'models/animals/pack_boar_game.glb',
      fox: 'models/animals/pack_fox_game.glb',
      rabbit: 'models/animals/rabbit_rigged.glb',
      monkey: 'models/animals/chimpanzee_monkey_3d_model_free_game.glb',
      elk: 'models/animals/realistic_animated_elk_3d_model_game.glb',
    },
  },

  camera: {
    // Toàn cảnh: mũi đá ở góc đông, đảo cao thấp là trung tâm
    overview: { pos: [170, 72, 150], tgt: [35, 8, 0] },
    lighthouse: { pos: [128, 52, 38], tgt: [88, 28, -5] },
  },
  controls: { minDistance: 12, maxDistance: 260 },
};
