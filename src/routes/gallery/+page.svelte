<script lang="ts">
	import { goto } from '$app/navigation';
	import { exportSave, getDateFilename, importSave, promptFile } from '$lib';
	import { Button, Modal, ModalFooter, Styles, Toast } from '@sveltestrap/sveltestrap';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';

  let images: Image[] = $state([]);
  let visibleImages: Image[] = $state([]);
  let modalImage: Image | null = $state(null);
  let page = 0;
  const pageSize = 20;

  const loadedApiKeys = writable<ApiKey[]>([])
  const currentApiKey = writable<ApiKey | null>(null)
  const savedModels = writable<Model[]>([])
  const savedImages = writable<Image[]>([])
  const savedLoras = writable<LoRA[]>([])
  const creditsLeft = writable(0)

  interface LoRA {
    id: string
    title: string
    description: string
  }

  let lastImageSelected: {
    imageUrl: string,
    imageObject: Image
  } | null= $state(null)

  onMount(() => {
    const rawApiKeys = localStorage.getItem('apiKeys')
    if (rawApiKeys != null) {
      const apiKeys = JSON.parse(rawApiKeys)
      loadedApiKeys.set(apiKeys)
    }
    const rawModels = localStorage.getItem('models')
    if (rawModels != null) {
      const models: Model[] = JSON.parse(rawModels)
      savedModels.set(models)
    }
    const rawImages = localStorage.getItem('images')
    if (rawImages != null) {
      const images: Image[] = JSON.parse(rawImages)
      savedImages.set(images)
    }
    const rawLoras = localStorage.getItem('loras')
    if (rawLoras != null) {
      const loras: LoRA[] = JSON.parse(rawLoras)
      savedLoras.set(loras)
    }

    creditsLeft.set(availableCredits())
  })

  function availableCredits() {
    let creditsLeft = 0;
    $loadedApiKeys.forEach(apiKey => {
      creditsLeft += apiKey.creditsLeft
    })
    return creditsLeft
  }

  interface ImgRequest {
  // Required
  /**
   * Access token (API Key)
   */
  access_token: string;
  /**
   * Model ID
   */
  model_id: string;
  /**
   * Prompt text
   */
  prompt: string;

  // Optional with defaults and validation notes
  /**
   * Model version, defaults to latest version
   */
  version?: string;
  /**
   * Default = 512, must be multiple of 8, range 128-896 (common: 512, 640, 768)
   */
  width?: number;
  /**
   * Default = 768, must be multiple of 8, range 128-896 (common: 512, 640, 768)
   */
  height?: number;

  /**
   * Optional negative prompt
   */
  negative_prompt?: string;
  /**
   * Whether to append default negative prompt, default = "true"
   */
  use_default_neg?: 'true' | 'false';

  /**
   * Number of inference steps, default = 30, range 1-50
   */
  steps?: number;
  /**
   * Guidance scale, default = 7.5 or model's default, range 1-20
   */
  scale?: number;

  /**
   * Number of images, default = 4
   */
  num_images?: number;
  /**
   * Seed, default = random (-1)
   */
  seed?: number;
  /**
   * Scheduler, default = "DPMSolverMultistep" or model's default
   */
  scheduler?: string;

  /**
   * LoRA model ID, query /models to get full list
   */
  lora?: string;
  /**
   * LoRA scale, default = 0.75
   */
  lora_scale?: number;

  // ControlNet
  /**
   * Valid values for ControlNet
   */
  controlnet?: 'canny' | 'depth' | 'openpose';
  }

  interface Img2ImgRequest extends ImgRequest {
  // For img2img (image transformation)
  /**
   * Base image file, required for img2img
   */
  init_image_file?: File;
  /**
   * How much to transform base image, default = 0.75
   */
  image_strength?: number;
  }

  interface ApiKey {
    code: string;
    creditsLeft: number
  }

  interface Model {
    id: string
    title: string
    description: string
  }

  interface Image extends Img2ImgRequest {
    /**
     * Generated image URL
     */
    image_url: string
    index?: number
  }

  function deleteAllImages() {
    savedImages.set([])
    localStorage.removeItem('images')
    showToast({
      title: 'All the images has been removed',
      description: `
      Why?
      `
    })
  }

  function deleteAllKeys() {
    savedImages.set([])
    localStorage.removeItem('apiKeys')
    showToast({
      title: 'All the API keys has been removed',
      description: `
      Why?
      `
    })
  }

  function deleteAllModels() {
    savedImages.set([])
    localStorage.removeItem('models')
    showToast({
      title: 'All the models has been removed',
      description: `
      Why?
      `
    })
  }

  function deleteAllLoRAs() {
    savedImages.set([])
    localStorage.removeItem('loras')
    showToast({
      title: 'All the LoRAs has been removed',
      description: `
      Why?
      `
    })
  }

  function loadMore() {
    const start = page * pageSize;
    const end = start + pageSize;
    visibleImages = [...visibleImages, ...images.slice(start, end)];
    page++;
  }

  function handleScroll() {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
      loadMore();
    }
  }

  function retrieveImageInfo(imageUrl: string): Image {
    if (imageUrl === lastImageSelected?.imageUrl) {
      return lastImageSelected.imageObject
    }
    const savedImage = $savedImages.find(img => img.image_url === imageUrl)
    if (savedImage == null) {
      throw new Error('Image not found')
    }
    return savedImage
  }

  onMount(() => {
    images = $savedImages.map((item, index) => ({
      ...item,
      index
    }));
    loadMore();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  });

  export const prerender = true;

  let openModal = $state(false);
  let modalText = $state('Modal text')
  let modalTitle = $state('Modal title')
  let modalCallback: null | (() => void) = $state(null)

  const toggleModal = () => (openModal = !openModal);

  function showConfirmationModal(opts: {
    title: string,
    description: string,
    callbackFn: () => void
  }) {
    modalTitle = opts.title
    modalText = opts.description
    modalCallback = async () => {
      await opts.callbackFn()
      modalCallback = null
    }
    openModal = true;
  }

  function showModal(opts: {
    title: string,
    description: string
  }) {
    modalTitle = opts.title
    modalText = opts.description
    openModal = true;
  }

  let openToast = $state(false)
  let toastHeader = $state('Toast header')
  let toastBody = $state('Toast body')

  function showToast(opts: {
    title: string,
    description: string
  }) {
    toastHeader = opts.title
    toastBody = opts.description
    openToast = true
  }

  function hideToast() {
    openToast = false
  }

  function removeImage(imageUrl: string, confirm: boolean = false) {
    if (confirm) {
      savedImages.set($savedImages.filter(image => image.image_url !== imageUrl))
      localStorage.setItem('images', JSON.stringify($savedImages))
      images = $savedImages.filter(img => img.image_url !== imageUrl)
      visibleImages = visibleImages.filter(img => img.image_url !== imageUrl);
      modalImage = null
    }
    showConfirmationModal({
      title: 'Are you sure?',
      description: `
      <p>
      This image will be PERMANENTLY removed
      </p>
      `,
      callbackFn: () => {
        removeImage(imageUrl, true)
      }
    })
  }
</script>

<Styles></Styles>

<main class="bg-[#1A1A1A] flex flex-col justify-evenly items-center gap-8 py-12 min-h-screen">
  <Modal body header="Modal title" isOpen={openModal} toggle={toggleModal} theme="light">
    <p>{@html modalText}</p>
    <ModalFooter>
      {#if modalCallback !== null}
      <Button color="danger" onclick={async () => {
        if (modalCallback !== null) {
          await modalCallback()
          toggleModal()
        }
      }}>Confirm</Button>
      <Button color="primary" onclick={() => {
        modalCallback = null
        toggleModal()
      }}>Cancel</Button>
      {:else}
      <Button color="primary" onclick={toggleModal}>Ok</Button>
      {/if}
    </ModalFooter>
  </Modal>
  <div class="fixed top-2 right-2">
    <Toast autohide body header={toastHeader} isOpen={openToast} on:close={() => (openToast = false)}>
      {@html toastBody}
    </Toast>
  </div>
  <section class="text-blue-500 flex flex-col md:flex-row gap-3 justify-center items-center">
    <h2 class="text-4xl">SinkinAI API frontend</h2>
    <p class="text-white">
      API keys Available: {$loadedApiKeys.length}
      <br/>
      Models saved: {$savedModels.length}
      <br/>
      Images saved: {$savedImages.length}
      <br/>
      LoRAs saved: {$savedLoras.length}
      <br/>
      Credits left: {$creditsLeft}
    </p>
    <div class="flex flex-col gap-1 justify-center items-center">
      <Button outline color="primary" onclick={() => {
        exportSave("sinkinAPI-" + getDateFilename(), {
          savedApiKeys: $loadedApiKeys,
          savedImages: $savedImages,
          savedLoRAs: $savedLoras,
          savedModels: $savedModels
        })
      }}>Export configuration</Button>
      <Button outline color="success" onclick={async () => {
        const file = await promptFile()
        if (file === null) {
          showToast({
            title: 'Select a valid file to import',
            description: 'The selected file should be exported from this application, if not, it can broke your saved data'
          })
          return
        }
        const result = await importSave(file, {
          savedApiKeys: $loadedApiKeys,
          savedImages: $savedImages,
          savedLoRAs: $savedLoras,
          savedModels: $savedModels
        })
        if (result) {
          showToast({
            title: 'The importation is done, please reload the page',
            description: 'The page will be reloaded automatically in 5 seconds'
          })
          setTimeout(() => {
            window.location.reload()
          }, 5000)
        } else {
          showToast({
            title: 'The file is invalid',
            description: 'Are you sure the file is a configuration file from this app? check console if so'
          })
        }
      }}>Import configuration</Button>
      <Button outline color="danger" onclick={() => {
        showConfirmationModal({
          title: 'Are you sure?',
          description: 'This wil <strong>DELETE ALL your saved data</strong>',
          callbackFn: () => {
            deleteAllImages(),
            deleteAllKeys(),
            deleteAllLoRAs(),
            deleteAllModels()
          }
        })
      }}>Delete configuration</Button>
    </div>
  </section>
  <Button outline color="warning" onclick={() => {
    goto('/')
  }}>Go to the main page</Button>

  <!-- Galería -->
  <div class="bg-[#1A1A1A] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
    {#each visibleImages as src}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <!-- svelte-ignore a11y_img_redundant_alt -->
      <img
        src={src.image_url}  
        alt="Generated illustration"
        class="w-full h-auto rounded shadow cursor-pointer transition-transform hover:scale-105"
        loading="lazy"
        onclick={() => modalImage = src}
      />
    {/each}
  </div>
  
  <!-- Modal -->
  {#if modalImage}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 overflow-auto bg-[#1A1A1A] flex flex-col md:flex-row items-center gap-4 z-50 px-4 py-4"
    >
      <img
        src={modalImage.image_url}
        alt="Information Modal"
        class="max-w-[70vh] max-h-[70vh] md:max-w-[90vh] md:max-h-[90vh] rounded shadow-lg"
      />
      <div class="flex flex-col gap-1 text-white">
        <Button color="info" onclick={() => {
          modalImage = null
        }}>Back to gallery</Button>
        <Button color="info" onclick={() => {
          if (modalImage?.index === undefined) return
          if (modalImage.index > images.length) return
          modalImage = images[modalImage.index + 1]
        }}>Next</Button>
        <Button color="info" onclick={() => {
          if (modalImage?.index === undefined) return
          if (modalImage.index === 0) return
          modalImage = images[modalImage.index - 1]
        }}>Previous</Button>
        <p>Image URL: {modalImage.image_url}</p>
        <p>Generated with prompt: {modalImage.prompt}</p>
        <p>Generated width: {modalImage.width}</p>
        <p>Generated height: {modalImage.height}</p>
        {#if modalImage.lora !== undefined}
        <p>Generated image with LoRA: {modalImage.lora}</p>
        <p>Generated image with LoRA scale: {modalImage.lora_scale}</p>
        {/if}
        <p>Generated image with model ID: {modalImage.model_id}</p>
        {#if modalImage.negative_prompt !== undefined}
        <p>Generated image with negative prompt: {modalImage.negative_prompt}</p>
        {/if}
        {#if modalImage.use_default_neg !== undefined}
        <p>Generated image with default negative prompt: {modalImage.use_default_neg}</p>
        {/if}
        {#if modalImage.scale !== undefined}
        <p>Generated image with custom guidance scale: {modalImage.scale}</p>
        {:else}
        <p>Generated image with default guidance scale: 7.5 or model's default</p>
        {/if}
        {#if modalImage.scheduler !== undefined}
        <p>Generated image with scheduler: {modalImage.scheduler}</p>
        {:else}
        <p>Generated image with default scheduler: DPMSolverMultistep or model's default</p>
        {/if}
        {#if modalImage.steps !== undefined}
        <p>Generated image with custom inference steps: {modalImage.steps}</p>
        {:else}
        <p>Generated image with default inference steps: 30</p>
        {/if}
        {#if modalImage.seed !== undefined}
        <p>Generated image with custom seed: {modalImage.seed}</p>
        {:else}
        <p>Generated image with random seed: -1</p>
        {/if}
        {#if modalImage.version !== undefined}
        <p>Generated image with model version: {modalImage.version}</p>
        {:else}
        <p>Generated image with latest model version</p>
        {/if}
        <Button color="danger" onclick={() => {
          if (modalImage?.image_url === undefined) return
          removeImage(modalImage.image_url)
        }}>Delete Image</Button>
      </div>
    </div>
  {/if}
</main>
