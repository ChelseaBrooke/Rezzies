<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	
	let { value = $bindable(), onSelect, placeholder = 'Enter address' }: {
		value?: string;
		onSelect?: (address: string, details?: any) => void;
		placeholder?: string;
	} = $props();
	
	let inputElement: HTMLInputElement | null = $state(null);
	let autocomplete: google.maps.places.Autocomplete | null = $state(null);
	let isLoaded = $state(false);
	let apiKey = $state('');
	
	// Initialize autocomplete when both API is loaded and input element is ready
	$effect(() => {
		if (!inputElement || !apiKey || autocomplete || !isLoaded) {
			return;
		}
		
		if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
			return;
		}
		
		try {
			console.log('AddressAutocomplete: Initializing autocomplete on input element');
			const ac = new google.maps.places.Autocomplete(inputElement, {
				types: ['address'],
				fields: ['formatted_address', 'address_components', 'geometry']
			});
			ac.addListener('place_changed', () => {
				const place = ac.getPlace();
				if (place?.formatted_address && inputElement) {
					inputElement.value = place.formatted_address;
					value = place.formatted_address;
					onSelect?.(place.formatted_address, place);
				}
			});
			autocomplete = ac;
			console.log('AddressAutocomplete: Autocomplete initialized successfully');
		} catch (error) {
			console.error('AddressAutocomplete: Error initializing autocomplete:', error);
		}
	});
	
	// Sync external value to input when it changes externally
	$effect(() => {
		if (inputElement && value !== undefined && inputElement.value !== value) {
			inputElement.value = value || '';
		}
	});
	
	onMount(async () => {
		// Get API key from environment
		const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
		apiKey = key;
		
		console.log('AddressAutocomplete: API Key check:', key ? 'Found' : 'NOT FOUND');
		
		if (!key) {
			console.warn('Google Maps API key not found. Address autocomplete will not work.');
			return;
		}
		
		// Check if Google Maps is already loaded
		if (typeof google !== 'undefined' && google.maps && google.maps.places) {
			console.log('AddressAutocomplete: Google Maps API already loaded');
			isLoaded = true;
			return;
		}
		
		// Check if script is already being loaded
		const existingScript = document.querySelector('script[src*="maps.googleapis.com"]') as HTMLScriptElement;
		if (existingScript) {
			console.log('AddressAutocomplete: Google Maps script already exists, waiting for load...');
			// Wait for it to load
			const checkInterval = setInterval(() => {
				if (typeof google !== 'undefined' && google.maps && google.maps.places) {
					clearInterval(checkInterval);
					console.log('AddressAutocomplete: Google Maps API loaded');
					isLoaded = true;
				}
			}, 100);
			
			// Timeout after 10 seconds
			setTimeout(() => {
				clearInterval(checkInterval);
				if (!isLoaded) {
					console.error('AddressAutocomplete: Timeout waiting for Google Maps API');
				}
			}, 10000);
			return;
		}
		
		try {
			console.log('AddressAutocomplete: Loading Google Maps API script...');
			
			// Create script tag with API key (standard URL; no loading=async to avoid load issues on some routes)
			const script = document.createElement('script');
			script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
			script.async = true;
			script.defer = true;
			
			script.onload = async () => {
				console.log('AddressAutocomplete: Google Maps API script loaded');
				
				// Wait for the API to be ready (classic script exposes google synchronously after load)
				await new Promise(resolve => setTimeout(resolve, 150));
				
				if (typeof google !== 'undefined' && google.maps && google.maps.places) {
					console.log('AddressAutocomplete: Google Maps API ready with Places');
					isLoaded = true;
					return;
				}
				// Fallback: try dynamic loader if available
				if (typeof google !== 'undefined' && google.maps && google.maps.importLibrary) {
					try {
						await google.maps.importLibrary('places');
						if (typeof google !== 'undefined' && google.maps && google.maps.places) {
							isLoaded = true;
							return;
						}
					} catch (err) {
						console.warn('AddressAutocomplete: Could not import places library:', err);
					}
				}
				console.error('AddressAutocomplete: Google Maps API loaded but places not available');
			};
			
			script.onerror = (error) => {
				console.error('AddressAutocomplete: Error loading Google Maps API script:', error);
			};
			
			document.head.appendChild(script);
		} catch (error) {
			console.error('Error loading Google Maps API:', error);
		}
	});
	
	onDestroy(() => {
		if (autocomplete) {
			google.maps.event.clearInstanceListeners(autocomplete);
		}
	});
	
	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
	}
</script>

<input
	bind:this={inputElement}
	type="text"
	class="address-input"
	value={value || ''}
	oninput={handleInput}
	{placeholder}
	autocomplete="off"
	id="address-autocomplete-input"
/>

<style>
	.address-input {
		width: 100%;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 0;
		font-size: 0.8125rem;
		font-family: inherit;
		color: var(--text);
		background: white;
		transition: all 0.2s ease;
	}
	
	.address-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(47, 119, 120, 0.1);
	}
	
	.address-input::placeholder {
		color: var(--muted);
	}
</style>
