// @ts-check
const axiosBase = require("axios").default;
// prettier-ignore
const { ASANA: { ACCESS_TOKEN, PROJECT_ID } } = require("./config.json")

const axios = axiosBase.create({
  baseURL: "https://app.asana.com/api/1.0",
  headers: {
    Authorization: "Bearer " + ACCESS_TOKEN,
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  responseType: "json",
});

class Asana {
  /**
   *
   */
  static async getWorkspaces() {
    const url = `/workspaces`;
    return (await axios.get(url)).data.data;
  }
  /**
   *
   */
  static async getProjects() {
    const url = `/projects`;
    return (await axios.get(url)).data.data;
  }
  /**
   * @returns { Promise<{ gid: string, name: string }[]> }
   */
  static async getSections() {
    const url = `/projects/${PROJECT_ID}/sections`;
    return (await axios.get(url)).data.data;
  }
  /**
   *
   * @param {string} sectionId
   * @returns {Promise<{gid: string, name: string, notes?: string}[]>}
   */
  static async getTasksFromSection(sectionId) {
    const url = `/sections/${sectionId}/tasks`;
    return (await axios.get(url)).data.data;
  }
  /**
   *
   * @param {string} taskId
   * @returns {Promise<{gid: string, name: string}[]>}
   */
  static async getSubTasks(taskId) {
    const url = `/tasks/${taskId}/subtasks`;
    return (await axios.get(url)).data.data;
  }
  /**
   *
   * @param {string} name
   */
  static async createSection(name) {
    const data = { data: { name } };
    const url = `/projects/${PROJECT_ID}/sections`;
    return (await axios.post(url, data)).data.data;
  }
  /**
   *
   * @param {*} data
   * @returns {Promise<{gid: string, name: string}>}
   */
  static async createTask(data) {
    const url = `/tasks`;
    return (await axios.post(url, { data })).data.data;
  }
  /**
   *
   * @param {string} task_gid
   * @param {*} data
   */
  static async updateTask(task_gid, data) {
    const url = `/tasks/${task_gid}`;
    return (await axios.put(url, { data })).data;
  }
  /**
   *
   * @param {string} task_gid
   * @param {*} data
   * @returns {Promise<{gid: string}>}
   */
  static async createSubTask(task_gid, data) {
    const url = `/tasks/${task_gid}/subtasks`;
    return (await axios.post(url, { data })).data.data;
  }
  /**
   *
   * @param {string} section_gid
   * @param {{task: string}} data
   */
  static async addTaskToSection(section_gid, data) {
    const url = `/sections/${section_gid}/addTask`;
    return axios.post(url, { data });
  }
  /**
   *
   * @param {string} workspace_gid
   */
  static async getTeams(workspace_gid) {
    const url = `/organizations/${workspace_gid}/teams`;
    return (await axios.get(url)).data.data;
  }
  /**
   *
   * @param {string} team_gid
   */
  static async getUsersInTeam(team_gid) {
    const url = `/teams/${team_gid}/users`;
    return (await axios.get(url)).data.data;
  }
}
module.exports = Asana;
