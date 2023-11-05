(function () {
	'use strict';
	themeManager.init();
	var csInterface = new CSInterface();

	const button = document.getElementById('executeCommand');

	button.addEventListener('click', function() {
		//alert("clicked")
		this.textContent = 'Removing Silence!';
		this.disabled = true;
		showLoadingBar();
		startFictitiousProgress();
		csInterface.evalScript('getSelectedClipPath()', function(result) {
			if (result === 'null1 no active sequence' || result === 'null2' || result === undefined) {
				alert("No active sequence or no clip selected.");
				completeLoading()
				// Handle the error, update UI accordingly
			} else if (result) {
				//alert(result)
				handleClipPath(result); // Process the result
			} else {
				alert("Unknown error occurred.");
				completeLoading()
				// Handle the unknown error
			}
		});
	});

	function handleClipPath(result) {
		if (result && result !== 'null1 no active sequence' && result !== 'null2') {
			const filePath = result; // Assuming result is the path returned from getSelectedClipPath	
			const extensionRoot = csInterface.getSystemPath(SystemPath.EXTENSION).replace(/\//g, '\\');
			const editorExecutablePath = `${extensionRoot}\\auto-editor\\dist\\__main__.exe`;
			const command = `"${editorExecutablePath}" "${filePath}" --edit audio:threshold=${silenceThreshold}% --export premiere`;
	
			//alert("Command:" + command)
			//alert("Executing command")
			
			const { exec } = require('child_process');
			exec(command, (error, stdout, stderr) => {
				if (error) {
					completeLoading();
					button.disabled = false; // Re-enable the button
					alert("Execution error: " + error);
					return;
				}
				if (stderr) {
					completeLoading();
					button.disabled = false; // Re-enable the button
					alert("Error output: " + stderr);
					return;
				}
			
				console.log(`Standard output: ${stdout}`);
				const alteredFilePath = replaceWithAlteredXML(filePath);
				renameSequenceInXML(alteredFilePath, 'Silenced Removed', function(updatedFilePath) {
					openXML(updatedFilePath); 
				});
			});
		} else {
			let errorMessage = 'An unexpected error occurred.';
			if (result.includes('null1')) {
				errorMessage = 'No active sequence.';
			} else if (result.includes('null2')) {
				errorMessage = 'No clip selected on the timeline.';
			}
			alert(errorMessage);
			completeLoading()
		}
	}

	function replaceWithAlteredXML(filePath) {
		// This will remove any existing file extension and append _ALTERED.xml
		return filePath.replace(/\.[^\.]+$/, '_ALTERED.xml');
	}

	function openXML(alteredfilePath) {
		// Assuming that 'safeFilePath' should be the same as the 'filePath' passed to 'openXML'
		const safeFilePath = alteredfilePath.replace(/\\/g, '\\\\'); // Adjust the path format if necessary
		//alert("safe file path:" + safeFilePath)
		csInterface.evalScript('openInPremiere("' + safeFilePath + '")', function(result) {
			completeLoading();
			button.disabled = false;
			if (result === "File imported successfully.") {
				// Handle the success, maybe update the UI or continue the workflow
				//alert(result);
			} else {
				// Handle the failure, inform the user or log the error
				alert(result);
			}
		});
	}

	var silenceThreshold = 20;

	document.getElementById('silenceSensitivity').addEventListener('input', function(e) {
		silenceThreshold = this.value;
		var value = (this.value-this.min)/(this.max-this.min)*100; // Calculate the percentage position
		var rangeValue = document.getElementById('rangeValue');
		rangeValue.innerText = this.value + '%'; // Update the text display
		
		// Adjust the position of the rangeValue element based on the slider
		rangeValue.style.left = `calc(${value}% + (${8 - value * 0.15}px))`; // Adjust the '8' and '0.15' to fit the slider thumb size and offset
		document.getElementById('rangeValue').innerText = silenceThreshold + '%';
	});

	var slider = document.getElementById('silenceSensitivity');
	var rangeValue = document.getElementById('rangeValue');

	// Function to update the position and text of the rangeValue
	function updateRangeValue() {
		var value = (slider.value - slider.min) / (slider.max - slider.min) * 100;
		rangeValue.innerText = slider.value + '%';
		rangeValue.style.left = `calc(${value}% + (${8 - value * 0.15}px))`;
	}

	// Show the rangeValue when interacting with the slider
	slider.addEventListener('mousedown', function() {
		rangeValue.style.visibility = 'visible';
		updateRangeValue();
	});

	slider.addEventListener('touchstart', function() {
		rangeValue.style.visibility = 'visible';
		updateRangeValue();
	});

	// Update the rangeValue position and text while sliding
	slider.addEventListener('input', function() {
		updateRangeValue();
	});

	// Hide the rangeValue when not interacting with the slider
	function hideRangeValue() {
		rangeValue.style.visibility = 'hidden';
	}

	slider.addEventListener('mouseup', hideRangeValue);
	slider.addEventListener('mouseleave', hideRangeValue);
	slider.addEventListener('touchend', hideRangeValue);

	// Initialize the rangeValue text and position
	updateRangeValue();

	function showLoadingBar() {
		document.getElementById('loadingBarContainer').style.display = 'block';
		document.getElementById('loadingBar').style.width = '0%'; // Start at 0%
	}
	
	function hideLoadingBar() {
		document.getElementById('loadingBarContainer').style.display = 'none';
	}
	
	function updateLoadingBar(percent) {
		document.getElementById('loadingBar').style.width = percent + '%';
	}

	let loadingInterval; // Holds the interval ID

	function startFictitiousProgress() {
		let progress = 0;
		const maxFictitiousProgress = 90; // Go up to 90% only
		const progressIncrement = 1; // Increment by 1%
		const intervalTime = 100; // Time in milliseconds between increments

		loadingInterval = setInterval(() => {
			if (progress < maxFictitiousProgress) {
				progress += progressIncrement;
				updateLoadingBar(progress);
			} else {
				clearInterval(loadingInterval); // Stop the interval if it reaches 90%
			}
		}, intervalTime);
	}

	function completeLoading() {
		clearInterval(loadingInterval); // Stop the fictitious progress
		updateLoadingBar(100); // Jump to 100%
		setTimeout(hideLoadingBar, 500); // Give a little time to see the bar at 100%
		resetButton()
	}

	function resetButton() {
		button.textContent = 'Remove Silence'; // Reset the button text to original
		button.disabled = false; // Enable the button again
	}

	function renameSequenceInXML(filePath, newName, callback) {
		const fs = require('fs');
		fs.readFile(filePath, 'utf8', function(err, data) {
			if (err) {
				console.error('Error reading XML file:', err);
				alert('Error reading XML file.');
				return;
			}
	
			// Use a simple string replace to change the sequence name
			let updatedData = data.replace('<name>Auto-Editor Media Group</name>', `<name>${newName}</name>`);
	
			// Write the updated XML back to the file
			fs.writeFile(filePath, updatedData, 'utf8', function(err) {
				if (err) {
					console.error('Error writing XML file:', err);
					alert('Error writing XML file.');
					return;
				}
	
				if (callback) {
					callback(filePath);
				}
			});
		});
	}
}());
