# Digital Twin for Chemical Factory Monitoring and Risk Prediction

## Overview

This project presents an Industry 4.0-inspired Digital Twin for a chemical manufacturing process. The system creates a virtual representation of a factory by collecting real-time process data from multiple wireless sensor nodes and visualizing it through a local web dashboard.

The architecture consists of two slave nodes and one master node communicating wirelessly using NRF24L01 transceivers. Sensor and equipment parameters are transmitted to the master node, which processes the data and updates the digital twin environment. An XGBoost machine learning model is integrated to classify operating conditions as either **Risk** or **No Risk**, enabling predictive monitoring and decision support.

## Features

* Real-time monitoring of process parameters
* Wireless communication using NRF24L01 modules
* Multi-node architecture (2 Slave Nodes + 1 Master Node)
* Local LAN-based deployment (No Internet Required)
* Web dashboard for visualization
* Industry 4.0 Digital Twin implementation
* XGBoost-based risk prediction
* What-if analysis and process simulation
* Low-cost embedded hardware implementation

## System Architecture

### Slave Nodes

* Collect sensor and equipment parameters
* Transmit data wirelessly to the master node
* Built using Arduino Nano and NRF24L01

### Master Node

* Receives and processes incoming data
* Communicates with the local dashboard
* Provides real-time updates to the digital twin

### Dashboard

* Displays equipment and process parameters
* Visualizes factory status
* Shows risk prediction results
* Supports operational analysis

## Hardware Components

* Arduino Nano (3 Units)
* NRF24L01 Wireless Modules (3 Units)
* Sensors (Based on Process Requirements)
* Local Computer/Server for Dashboard Hosting

## Software Stack

* Arduino IDE
* Embedded C/C++
* NRF24L01 Communication Library
* HTML/CSS/JavaScript
* Python
* XGBoost Machine Learning Model

## Workflow

1. Slave nodes collect process parameters.
2. Data is transmitted wirelessly using NRF24L01 modules.
3. Master node receives and processes the incoming data.
4. Data is displayed on the local web dashboard.
5. Process parameters are passed to the XGBoost model.
6. Model predicts whether the operating condition is Risk or No Risk.
7. Results are visualized through the digital twin interface.

## Applications

* Chemical Plant Monitoring
* Industrial IoT (IIoT)
* Industry 4.0 Systems
* Smart Manufacturing
* Process Optimization
* Predictive Maintenance
* Risk Assessment

## Future Improvements

* ESP32-based implementation
* MQTT communication support
* Cloud integration with AWS IoT
* Database logging and analytics
* Predictive maintenance models
* Real-time alerts and notifications
* Custom PCB design for deployment

## Technologies Used

* Arduino Nano
* NRF24L01
* Embedded C
* Python
* XGBoost
* Wireless Sensor Networks
* Industry 4.0
* Industrial IoT (IIoT)
* Digital Twin Technology




