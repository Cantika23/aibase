import { TypedTool, ToolParameterSchema } from '../../types';
import { getAPIKey } from '../../config';

/**
 * Weather Tool - Get weather information using OpenWeatherMap API
 */
export class WeatherTool extends TypedTool {
  name = 'weather';
  description = 'Get current weather information for a location using OpenWeatherMap API';

  parameterSchema: Record<string, ToolParameterSchema> = {
    location: {
      type: 'string',
      description: 'City name or location (e.g., "London", "New York, NY")',
      required: true
    },
    units: {
      type: 'string',
      description: 'Units for temperature values',
      enum: ['metric', 'imperial', 'kelvin'],
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name or location (e.g., "London", "New York, NY")'
      },
      units: {
        type: 'string',
        description: 'Units for temperature values',
        enum: ['metric', 'imperial', 'kelvin']
      }
    },
    required: ['location']
  };

  protected async executeTyped(args: {
    location: string;
    units?: string;
  }): Promise<any> {
    const { location, units = 'metric' } = args;
    const apiKey = getAPIKey('openweathermap');

    if (!apiKey) {
      throw new Error('OpenWeatherMap API key is not configured. Please set OPENWEATHER_API_KEY environment variable.');
    }

    try {
      // Construct API URL
      const baseUrl = 'https://api.openweathermap.org/data/2.5/weather';
      const params = new URLSearchParams({
        q: location,
        appid: apiKey,
        units
      });

      const url = `${baseUrl}?${params}`;

      // Make API request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenWeatherMap API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      // Process and format the response
      return {
        location: data.name,
        country: data.sys.country,
        coordinates: {
          lat: data.coord.lat,
          lon: data.coord.lon
        },
        weather: {
          main: data.weather[0].main,
          description: data.weather[0].description,
          icon: data.weather[0].icon
        },
        temperature: {
          current: data.main.temp,
          feels_like: data.main.feels_like,
          min: data.main.temp_min,
          max: data.main.temp_max
        },
        conditions: {
          pressure: data.main.pressure,
          humidity: data.main.humidity,
          visibility: data.visibility,
          wind_speed: data.wind.speed,
          wind_direction: data.wind.deg
        },
        units,
        timestamp: new Date().toISOString(),
        data_source: 'OpenWeatherMap'
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Weather lookup failed: ${error.message}`);
      }
      throw new Error('Weather lookup failed: Unknown error');
    }
  }
}